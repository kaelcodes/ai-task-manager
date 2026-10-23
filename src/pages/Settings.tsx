import { useState, useEffect } from "react";
import { saveApiKey, getApiKeyStatus, deleteApiKey } from "../ai";
import type { Preferences, Priority, TaskStatus, AccentColor, Task } from "../types";
import { ACCENT_HEX } from "../services/preferences";
import {
  deleteAllTasks,
  exportTasksEnvelope,
  parseTaskBackup,
  importTasksAtomic,
} from "../services";
import shellStyles from "../components/PageShell.module.css";
import styles from "./Settings.module.css";

interface SettingsProps {
  preferences: Preferences;
  onUpdatePreferences: (next: Preferences) => Promise<void>;
  /** Shared task list (for export). */
  tasks: Task[];
  /** Refresh shared task state after a destructive data operation. */
  onTasksChange: () => Promise<void>;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

const ACCENT_OPTIONS: AccentColor[] = ["indigo", "emerald", "amber", "rose", "sky"];

export default function Settings({
  preferences,
  onUpdatePreferences,
  tasks,
  onTasksChange,
}: SettingsProps) {
  const [hasKey, setHasKey] = useState<boolean | null>(null); // null = loading
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data section state (Module 9 + v0.2 M3).
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [dataMsg, setDataMsg] = useState<string | null>(null);

  // Import state (v0.2 M3).
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);

  function exportTasksJson() {
    setDataMsg(null);
    try {
      // Export the versioned, tasks-only envelope — no API key, no preferences.
      const json = JSON.stringify(exportTasksEnvelope(tasks), null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `ai-task-manager-tasks-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDataMsg(`Exported ${tasks.length} task${tasks.length !== 1 ? "s" : ""} to JSON.`);
    } catch (err) {
      console.error("[Settings] export failed:", err);
      setDataMsg("Failed to export tasks.");
    }
  }

  async function handleConfirmClear() {
    setClearing(true);
    setDataMsg(null);
    try {
      await deleteAllTasks();
      await onTasksChange();
      setConfirmingClear(false);
      setDataMsg("All tasks cleared. Preferences and API key were not affected.");
    } catch (err) {
      console.error("[Settings] clear all failed:", err);
      setDataMsg("Failed to clear tasks. Nothing was changed.");
    } finally {
      setClearing(false);
    }
  }

  async function handleImport() {
    if (importing) return; // guard against duplicate submissions
    setImportMsg(null);
    setImportErr(null);

    const result = parseTaskBackup(importText);
    if ("error" in result) {
      setImportErr(result.error); // validation failed → zero DB writes
      return;
    }
    if (result.tasks.length === 0) {
      setImportErr("The backup contains no tasks to import.");
      return;
    }

    setImporting(true);
    try {
      const count = await importTasksAtomic(result.tasks);
      await onTasksChange();
      setImportText("");
      setImportMsg(
        `Imported ${count} task${count !== 1 ? "s" : ""} (added as new tasks).`
      );
    } catch (err) {
      console.error("[Settings] import failed:", err);
      setImportErr("Import failed. No tasks were added.");
    } finally {
      setImporting(false);
    }
  }

  // Check on mount whether a key is already stored
  useEffect(() => {
    getApiKeyStatus()
      .then(setHasKey)
      .catch(() => setHasKey(false));
  }, []);

  function clearMessages() {
    setError(null);
    setSuccessMsg(null);
  }

  async function handleSave() {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setError("Please enter an API key before saving.");
      return;
    }
    clearMessages();
    setSaving(true);
    try {
      await saveApiKey(trimmed);
      setHasKey(true);
      setKeyInput("");
      setSuccessMsg("API key saved to OS credential store.");
    } catch (err) {
      setError(typeof err === "string" ? err : "Failed to save API key.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    clearMessages();
    setDeleting(true);
    try {
      await deleteApiKey();
      setHasKey(false);
      setSuccessMsg("API key removed.");
    } catch (err) {
      setError(typeof err === "string" ? err : "Failed to remove API key.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={shellStyles.page}>
      <header className={shellStyles.header}>
        <h1 className={shellStyles.title}>Settings</h1>
        <p className={shellStyles.subtitle}>Configure your preferences.</p>
      </header>

      {/* ── AI Configuration ─────────────────────────────────────────────── */}
      <section className={shellStyles.section}>
        <h2 className={shellStyles.sectionTitle}>AI Configuration</h2>

        <div className={styles.settingCard}>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>OpenAI API Key</span>
              <span className={styles.settingDesc}>
                {hasKey === null
                  ? "Checking credential store…"
                  : hasKey
                    ? "A key is stored in your OS credential store."
                    : "No key configured. Enter your OpenAI API key to enable the AI Assistant."}
              </span>
            </div>
            <span
              className={`${styles.statusPill} ${hasKey ? styles.statusPillActive : styles.statusPillMissing}`}
              aria-label={hasKey ? "API key configured" : "API key not configured"}
            >
              {hasKey === null ? "…" : hasKey ? "Configured" : "Not set"}
            </span>
          </div>

          {/* Error / success banner */}
          {error && (
            <div className={styles.settingBanner} role="alert" data-variant="error">
              {error}
            </div>
          )}
          {successMsg && (
            <div className={styles.settingBanner} role="status" data-variant="success">
              {successMsg}
            </div>
          )}

          {/* Key input — always visible so user can update */}
          <div className={styles.keyInputRow}>
            <input
              className={styles.keyInput}
              type="password"
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                clearMessages();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) void handleSave();
              }}
              placeholder={hasKey ? "Enter new key to replace…" : "sk-…"}
              aria-label="OpenAI API key"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className={styles.btnSave}
              onClick={() => void handleSave()}
              disabled={saving || deleting}
              aria-label="Save API key"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {hasKey && (
              <button
                className={styles.btnClear}
                onClick={() => void handleDelete()}
                disabled={saving || deleting}
                aria-label="Remove stored API key"
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            )}
          </div>

          <p className={styles.settingHint}>
            Your key is stored in the{" "}
            {navigator.platform.toLowerCase().includes("win")
              ? "Windows Credential Manager"
              : "OS keychain"}{" "}
            and never written to disk in plaintext. It is sent only from the
            Rust backend when making API requests.
          </p>
        </div>
      </section>

      {/* ── Personalization (Module 7) ────────────────────────────────────── */}
      <section className={shellStyles.section}>
        <h2 className={shellStyles.sectionTitle}>Personalization</h2>

        <div className={styles.settingCard}>
          {/* Accent color */}
          <div className={styles.prefRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Accent color</span>
              <span className={styles.settingDesc}>
                Applied across buttons and highlights.
              </span>
            </div>
            <div className={styles.swatchRow} role="radiogroup" aria-label="Accent color">
              {ACCENT_OPTIONS.map((accent) => (
                <button
                  key={accent}
                  className={`${styles.swatch} ${preferences.accentColor === accent ? styles.swatchActive : ""}`}
                  style={{ backgroundColor: ACCENT_HEX[accent] }}
                  onClick={() =>
                    void onUpdatePreferences({ ...preferences, accentColor: accent })
                  }
                  role="radio"
                  aria-checked={preferences.accentColor === accent}
                  aria-label={accent}
                  title={accent}
                />
              ))}
            </div>
          </div>

          {/* Default priority */}
          <div className={styles.prefRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Default task priority</span>
              <span className={styles.settingDesc}>
                Pre-selected when creating a new task.
              </span>
            </div>
            <select
              className={styles.prefSelect}
              value={preferences.defaultPriority}
              onChange={(e) =>
                void onUpdatePreferences({
                  ...preferences,
                  defaultPriority: e.target.value as Priority,
                })
              }
              aria-label="Default task priority"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Default status */}
          <div className={styles.prefRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Default task status</span>
              <span className={styles.settingDesc}>
                Pre-selected when creating a new task.
              </span>
            </div>
            <select
              className={styles.prefSelect}
              value={preferences.defaultStatus}
              onChange={(e) =>
                void onUpdatePreferences({
                  ...preferences,
                  defaultStatus: e.target.value as TaskStatus,
                })
              }
              aria-label="Default task status"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── Data (Module 9) ───────────────────────────────────────────────── */}
      <section className={shellStyles.section}>
        <h2 className={shellStyles.sectionTitle}>Data</h2>
        <div className={styles.settingCard}>
          {dataMsg && (
            <div className={styles.settingBanner} role="status" data-variant="success">
              {dataMsg}
            </div>
          )}

          {/* Export */}
          <div className={styles.prefRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Export tasks</span>
              <span className={styles.settingDesc}>
                Download all tasks as a JSON file. Does not include your API key or preferences.
              </span>
            </div>
            <button
              className={styles.btnSave}
              onClick={exportTasksJson}
              disabled={tasks.length === 0}
              aria-label="Export tasks to JSON"
            >
              Export
            </button>
          </div>

          {/* Clear all */}
          <div className={styles.prefRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Clear all tasks</span>
              <span className={styles.settingDesc}>
                Permanently deletes every task. Preferences and your API key are kept.
              </span>
            </div>
            {!confirmingClear ? (
              <button
                className={styles.btnClear}
                onClick={() => {
                  setDataMsg(null);
                  setConfirmingClear(true);
                }}
                disabled={tasks.length === 0}
                aria-label="Clear all tasks"
              >
                Clear all
              </button>
            ) : (
              <div className={styles.confirmInline} role="group" aria-label="Confirm clear all tasks">
                <span className={styles.confirmPrompt}>Delete all {tasks.length}?</span>
                <button
                  className={styles.btnClear}
                  onClick={() => void handleConfirmClear()}
                  disabled={clearing}
                  aria-label="Confirm clear all tasks"
                >
                  {clearing ? "Clearing…" : "Yes, delete"}
                </button>
                <button
                  className={styles.btnSecondary}
                  onClick={() => setConfirmingClear(false)}
                  disabled={clearing}
                  aria-label="Cancel clear all tasks"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Import (v0.2 M3) — paste a backup JSON; additive, new ids. */}
          <div className={styles.importBlock}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Import tasks</span>
              <span className={styles.settingDesc}>
                Paste a previously exported backup JSON. Tasks are added as new
                tasks (existing tasks are kept). Preferences and your API key
                are not part of a backup and are never imported.
              </span>
            </div>
            <textarea
              className={styles.importArea}
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportErr(null);
                setImportMsg(null);
              }}
              placeholder='{ "app": "ai-task-manager", "schemaVersion": 2, "exportedAt": "…", "tasks": [ … ] }'
              rows={4}
              spellCheck={false}
              aria-label="Backup JSON to import"
              disabled={importing}
            />
            {importErr && (
              <div className={styles.settingBanner} role="alert" data-variant="error">
                {importErr}
              </div>
            )}
            {importMsg && (
              <div className={styles.settingBanner} role="status" data-variant="success">
                {importMsg}
              </div>
            )}
            <div className={styles.importActions}>
              <button
                className={styles.btnSave}
                onClick={() => void handleImport()}
                disabled={importing || importText.trim().length === 0}
                aria-label="Import tasks from pasted JSON"
              >
                {importing ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Notifications (Planned) ───────────────────────────────────────── */}
      <section className={shellStyles.section}>
        <h2 className={shellStyles.sectionTitle}>Notifications</h2>
        <div className={shellStyles.list}>
          <div className={shellStyles.listItem}>
            <span className={shellStyles.listItemDotMuted} aria-hidden="true" />
            Operating-system notifications
            <span className={shellStyles.badge}>Planned</span>
          </div>
        </div>
        <p className={styles.settingHint}>
          Reminders currently appear inside the app. Native Windows notifications
          (including alerts while the app is closed) are planned for a later module.
        </p>
      </section>
    </div>
  );
}
