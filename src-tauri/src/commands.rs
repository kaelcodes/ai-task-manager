use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_keyring::KeyringExt;

// ── Keyring constants ────────────────────────────────────────────────────────

const KEYRING_SERVICE: &str = "ai-task-manager";
const KEYRING_USER: &str = "openai-api-key";

// ── Credential commands ───────────────────────────────────────────────────────

/// Save the user's API key to the OS credential store.
/// The key value is never returned to the frontend after this call.
#[tauri::command]
pub fn save_api_key(app: AppHandle, key: String) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("API key must not be empty.".to_string());
    }
    app.keyring()
        .set_password(KEYRING_SERVICE, KEYRING_USER, &key)
        .map_err(|e| format!("Failed to save API key: {e}"))
}

/// Return whether an API key is currently stored — never the key itself.
#[tauri::command]
pub fn get_api_key_status(app: AppHandle) -> bool {
    app.keyring()
        .get_password(KEYRING_SERVICE, KEYRING_USER)
        .map(|opt| opt.is_some())
        .unwrap_or(false)
}

/// Remove the stored API key from the OS credential store.
#[tauri::command]
pub fn delete_api_key(app: AppHandle) -> Result<(), String> {
    app.keyring()
        .delete_password(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("Failed to delete API key: {e}"))
}

// ── Shared message type (used by the chat command) ────────────────────────────

/// A single turn in the conversation history as sent by the frontend.
/// role is always "user" or "assistant".
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

// ── Gemini request types ──────────────────────────────────────────────────────

/// A single text part inside a Gemini Content object.
#[derive(Debug, Serialize)]
struct GeminiPart<'a> {
    text: &'a str,
}

/// A content turn in the Gemini `contents` array.
/// Role must be "user" or "model" (Gemini does not accept "assistant").
#[derive(Debug, Serialize)]
struct GeminiContent<'a> {
    role: &'a str,
    parts: Vec<GeminiPart<'a>>,
}

/// The system instruction wrapper (separate from the conversation contents).
#[derive(Debug, Serialize)]
struct GeminiSystemInstruction<'a> {
    parts: Vec<GeminiPart<'a>>,
}

/// Generation tuning parameters.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GeminiGenerationConfig {
    max_output_tokens: u32,
    temperature: f32,
}

/// Top-level Gemini generateContent request body.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GeminiRequest<'a> {
    contents: Vec<GeminiContent<'a>>,
    system_instruction: GeminiSystemInstruction<'a>,
    generation_config: GeminiGenerationConfig,
}

// ── Gemini response types ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct GeminiResponsePart {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiResponseContent {
    parts: Option<Vec<GeminiResponsePart>>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiResponseContent>,
    #[serde(rename = "finishReason")]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
}

/// Gemini error envelope — present when the API returns a 4xx/5xx body.
#[derive(Debug, Deserialize)]
struct GeminiErrorBody {
    error: GeminiErrorDetail,
}

#[derive(Debug, Deserialize)]
struct GeminiErrorDetail {
    message: String,
    #[serde(default)]
    status: String,
}

// ── Chat command ──────────────────────────────────────────────────────────────

/// Send the conversation history to the Gemini API and return the assistant reply.
///
/// The API key is retrieved from the OS credential store in Rust and placed in
/// the `x-goog-api-key` request header. It is never passed from or returned to
/// the frontend, and it is never included in log output.
#[tauri::command]
pub async fn chat(
    app: AppHandle,
    messages: Vec<ChatMessage>,
    system_prompt: String,
) -> Result<String, String> {
    // Retrieve key — never expose to caller or logs
    let api_key = app
        .keyring()
        .get_password(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("Credential store error: {e}"))?
        .ok_or_else(|| "no_api_key".to_string())?;

    // Map conversation history to Gemini's role vocabulary.
    // Gemini uses "user" and "model"; the frontend sends "user" and "assistant".
    let gemini_contents: Vec<GeminiContent> = messages
        .iter()
        .map(|m| GeminiContent {
            role: if m.role == "assistant" { "model" } else { "user" },
            parts: vec![GeminiPart { text: &m.content }],
        })
        .collect();

    let body = GeminiRequest {
        contents: gemini_contents,
        system_instruction: GeminiSystemInstruction {
            parts: vec![GeminiPart { text: &system_prompt }],
        },
        generation_config: GeminiGenerationConfig {
            max_output_tokens: 1024,
            temperature: 0.7,
        },
    };

    // Endpoint: key goes in the header, not the URL, to avoid credential exposure in logs
    let endpoint =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;
    let response = client
        .post(endpoint)
        .header("Content-Type", "application/json")
        .header("x-goog-api-key", &api_key)
        .json(&body)
        .send()
        .await
        // A genuine transport-layer failure (DNS, TLS, timeout, connection
        // reset). Tagged `transport:` so the frontend classifies it as a real
        // network error — never confused with an API/HTTP error response.
        .map_err(|e| format!("transport: {e}"))?;

    let status = response.status();
    let body_text = response
        .text()
        .await
        .map_err(|e| format!("transport: failed to read response: {e}"))?;

    if !status.is_success() {
        // The request reached Gemini and came back with an HTTP error status.
        // This is an API error, NOT a transport failure. Tag it with the
        // numeric status and the safe Gemini message so the frontend can
        // classify (e.g. 503/UNAVAILABLE = temporary service unavailability).
        // No secrets are included — only Gemini's own status/message text.
        let detail = serde_json::from_str::<GeminiErrorBody>(&body_text)
            .map(|b| {
                if b.error.status.is_empty() {
                    b.error.message
                } else {
                    format!("{}: {}", b.error.status, b.error.message)
                }
            })
            .unwrap_or_else(|_| "The AI service returned an error.".to_string());
        return Err(format!("api:{}: {detail}", status.as_u16()));
    }

    let parsed: GeminiResponse =
        serde_json::from_str(&body_text)
            .map_err(|e| format!("Failed to parse Gemini response: {e}"))?;

    // Extract the text from candidates[0].content.parts[0].text
    parsed
        .candidates
        .as_deref()
        .and_then(|c| c.first())
        .and_then(|c| {
            // Surface a clear message for safety/recitation blocks
            if let Some(reason) = &c.finish_reason {
                if reason != "STOP" && reason != "MAX_TOKENS" {
                    return Some(Err(format!(
                        "Response was blocked by Gemini safety filters (reason: {reason})."
                    )));
                }
            }
            c.content
                .as_ref()
                .and_then(|content| content.parts.as_deref())
                .and_then(|parts| parts.first())
                .and_then(|part| part.text.clone())
                .filter(|t| !t.is_empty())
                .map(Ok)
        })
        .unwrap_or_else(|| Err("Gemini returned an empty response.".to_string()))
}

// ── Atomic task import (v0.2 M3) ──────────────────────────────────────────────

/// One validated task to import. Ids are generated by SQLite (imported ids are
/// ignored by the frontend before this point). Optional text fields are null
/// when absent. `created_at`/`completed_at` are computed here.
#[derive(Debug, Deserialize)]
pub struct ImportTask {
    pub title: String,
    pub description: Option<String>,
    pub priority: String,
    pub status: String,
    pub category: Option<String>,
    pub deadline: Option<String>,
}

/// Insert all tasks inside a single SQLite transaction. Either every row is
/// committed or none are (on any error the transaction is rolled back / dropped
/// without commit). Opens a short-lived pool to the same `tasks.db` the app
/// uses (app config dir), so this never touches credentials or other tables.
///
/// Returns the number of rows inserted.
#[tauri::command]
pub async fn import_tasks(app: AppHandle, tasks: Vec<ImportTask>) -> Result<u64, String> {
    use tauri::Manager;

    if tasks.is_empty() {
        return Ok(0);
    }

    // Resolve the same DB file path tauri-plugin-sql uses: app_config_dir()/tasks.db
    let mut db_path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Could not resolve app config dir: {e}"))?;
    db_path.push("tasks.db");

    let url = format!("sqlite:{}", db_path.to_string_lossy());

    let pool = sqlx::SqlitePool::connect(&url)
        .await
        .map_err(|e| format!("Failed to open database: {e}"))?;

    // Single transaction — all-or-nothing.
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to begin transaction: {e}"))?;

    let now = chrono_now_iso();

    let mut count: u64 = 0;
    for t in &tasks {
        let completed_at: Option<String> = if t.status == "done" {
            Some(now.clone())
        } else {
            None
        };

        let res = sqlx::query(
            "INSERT INTO tasks
                (title, description, priority, status, category, deadline,
                 estimated_duration, created_at, completed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, ?8)",
        )
        .bind(&t.title)
        .bind(&t.description)
        .bind(&t.priority)
        .bind(&t.status)
        .bind(&t.category)
        .bind(&t.deadline)
        .bind(&now)
        .bind(&completed_at)
        .execute(&mut *tx)
        .await;

        if let Err(e) = res {
            // Explicit rollback, then fail — leaves zero rows from this batch.
            let _ = tx.rollback().await;
            pool.close().await;
            return Err(format!("Import failed (rolled back): {e}"));
        }
        count += 1;
    }

    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit import: {e}"))?;
    pool.close().await;

    Ok(count)
}

/// Current UTC time as an ISO 8601 string, matching the frontend's
/// `new Date().toISOString()` format — without adding a date dependency.
fn chrono_now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let dur = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs();
    let millis = dur.subsec_millis();

    // Civil date from Unix seconds (UTC). Algorithm: Howard Hinnant's days->y/m/d.
    let days = (secs / 86_400) as i64;
    let secs_of_day = secs % 86_400;
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };

    let hh = secs_of_day / 3600;
    let mm = (secs_of_day % 3600) / 60;
    let ss = secs_of_day % 60;

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        year, m, d, hh, mm, ss, millis
    )
}
