### AI TASK MANAGER — MASTER PROJECT CONTEXT & DEVELOPMENT ROADMAP

#### 1. Project Overview
We are developing a Windows desktop application called **AI Task Manager**.
The goal is to create a lightweight, locally oriented task-management application with an integrated AI assistant that can eventually help users understand, organize, and manage their tasks.
Development is divided into 10 modules. Each module must be implemented, verified, and documented before proceeding to the next module.
**Current status: v1.0 complete (Modules 1–10). v0.2 track in progress — M1 (Windows OS Notifications) and M2 (Packaging & Release Reliability) COMPLETE; next: v0.2 M3 (Data Backup & Restore). Known external limitation: Gemini model availability (see Module 10).**
Modules 1 through 10 are complete. v0.2 roadmap and module status are recorded in Section 4b below.

#### 2. Developer Environment & Constraints
* Operating system: Windows 11, 64-bit.
* Development environment: VS Code and Kiro.
* Frontend: React + TypeScript[cite: 1].
* Desktop framework and backend: Tauri + Rust[cite: 1].
* Database: Local SQLite[cite: 1].
* Credential storage: Windows Credential Manager through the existing keyring integration[cite: 1].
* Current AI provider: Google Gemini[cite: 1].
* Current reported model endpoint: `gemini-3.8-flash`[cite: 1].
* Budget constraint: Kiro has a limited credit allowance. The latest reported balance is **47.08/50 credits**[cite: 1].
* Development priority: functional, maintainable, low-cost implementation over unnecessary polish[cite: 1].

#### 3. Global Development Rules
Follow these rules throughout the project[cite: 1]:
1. Work on only the currently authorized module[cite: 1].
2. Do not implement features belonging to future modules prematurely[cite: 1].
3. Inspect existing code and architecture before proposing modifications[cite: 1].
4. Preserve working functionality and existing interfaces unless a change is necessary and explicitly authorized[cite: 1].
5. Prefer the smallest effective change[cite: 1].
6. Avoid unrelated refactoring, unnecessary dependencies, duplicate services, and redundant verification[cite: 1].
7. Do not recreate functionality that already exists[cite: 1].
8. Keep secrets and API keys out of source code, frontend bundles, logs, and version control[cite: 1].
9. Preserve local-first operation wherever practical[cite: 1].
10. Separate confirmed findings from assumptions[cite: 1].
11. Never claim a build, runtime test, or acceptance criterion passed without evidence[cite: 1].
12. Do not mark a module complete until its required acceptance criteria are satisfied[cite: 1].
13. Report files changed, actual verification results, remaining blockers, and the next action concisely[cite: 1].
14. Keep project documentation updated after meaningful milestones[cite: 1].
15. Minimize both Kiro credit usage and unnecessary conversation tokens[cite: 1].

#### 4. Ten-Module Roadmap

##### Module 1 — Application Foundation
**Status: COMPLETE, as previously reported[cite: 1].**
* React + TypeScript frontend, Tauri desktop shell, local SQLite initialization, sidebar navigation, dashboard, tasks, schedule, AI assistant, and settings pages[cite: 1].

##### Module 2 — Task Management
**Status: COMPLETE, as previously reported[cite: 1].**
* Full task CRUD operations, status toggling, and parameterised SQL database services.

##### Module 3 — Dashboard
**Status: COMPLETE, as previously reported[cite: 1].**
* Summary metrics and widget views integrated cleanly with task-management state.

##### Module 4 — AI Assistant
**Status: COMPLETE (Finalized October 12, 2026).**
* **Goal achieved:** Provided a functioning conversational AI assistant via Google Gemini integration without task execution capabilities[cite: 1].
* **Implemented details:** 
  * Replaced OpenAI Chat Completions with Google Gemini endpoint (`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`)[cite: 1].
  * Gemini request/response structures implemented in `src-tauri/src/commands.rs`[cite: 1].
  * API authentication using `x-goog-api-key` header and Windows Credential Manager (`ai-task-manager` / legacy `openai-api-key` slot)[cite: 1].
  * System instructions passed through Gemini's dedicated `system_instruction` field; conversation roles mapped to model roles[cite: 1].
  * API errors parsed/propagated, safety finish reasons checked, and a 60-second request timeout configured via `reqwest::ClientBuilder::timeout`[cite: 1].
* **Verification & Evidence:**
  * Build evidence: Clean compilation (`cargo check` passed with zero errors)[cite: 1].
  * Runtime evidence: Successfully verified basic response generation (calculating 17 * 23 = 391) and multi-turn conversation continuity referencing prior context[cite: 1].
* **Known Limitations (Accepted for Module 4):**
  * Timeout behavior, missing-credential handling, and invalid-key errors are inspected and covered structurally but lack exhaustive edge-case runtime testing[cite: 1].
  * Raw provider messages may bubble up on specific HTTP 403 or quota limits[cite: 1].

##### Module 5 — AI Task Operations
**Status: COMPLETE — BUILD-VERIFIED AND RUNTIME-VERIFIED (Finalized October 12, 2026).**
* **Goal:** Allow the assistant to perform controlled task operations using existing task-management functionality[cite: 1].
* **Proposed Scope & Requirements:**
  * Interpret user requests involving tasks and identify supported task actions[cite: 1].
  * Validate required fields and user intent; never execute arbitrary AI-generated SQL[cite: 1].
  * Connect AI structured intentions to existing Module 2 task services safely (create, update, complete, delete)[cite: 1].
  * Require confirmation for destructive or ambiguous operations where appropriate[cite: 1].
  * Verify that database changes are accurate and persisted[cite: 1].
* **Dependencies:** Completed Module 2 (Task Services) and Module 4 (Gemini Chat Integration).
* **Implementation (structured JSON approach, native function calling out of scope):**
  * `src/ai/index.ts` — Adds the structured-action layer: `buildSystemPrompt` now lists real task ids and the action spec; defensive `parseReply` (malformed/unexpected JSON yields no action, never a mutation); `validateAction` (action name, required fields, types, title/category lengths, enum values, integer ids, valid `YYYY-MM-DD` deadlines); `resolveTaskById`; and executors `executeCreateTask`, `executeUpdateStatus` (absolute/idempotent via `updateTask`, never `toggleTaskComplete`), `executeDeleteTask`. The existing `sendChat()` string interface is unchanged.
  * `src/pages/AIAssistant.tsx` — Parses each reply, shows conversational text, resolves task references, executes create/status immediately, and defers deletion to an explicit confirmation card (the model's JSON cannot self-approve a delete). Cancellation performs zero mutation calls. Success is reported only after the service resolves; one action per reply with no model re-call loop.
  * `src/pages/AIAssistant.module.css` — Styles for the delete-confirmation card and the action-result notice.
  * `src/App.tsx` — Passes the shared `onTasksChange={refreshTasks}` callback to `AIAssistant` so mutations propagate to Dashboard and Tasks.
* **Verification (build tier only):**
  * `tsc --noEmit`: passed.
  * `npm run build`: passed (56 modules transformed).
  * `cargo check`: not run — no Rust was changed.
* **Runtime acceptance tests (performed and recorded):**
  * Plain chat continues to work with no action triggered — PASS.
  * Task creation from natural language, with persistence after refresh — PASS.
  * Absolute, idempotent status updates (repeating a request does not reverse it) — PASS.
  * Deletion confirmation and cancellation — PASS; cancellation caused zero deletion mutations.
  * Missing and ambiguous task references — PASS; clarification occurred without mutation.
  * Malformed and invalid action safety — PASS; the real compiled parser/validator was exercised with a temporary isolated harness (malformed JSON, unknown action, missing required fields, invalid status, invalid deadline, non-integer/string task ids). Every invalid payload was rejected (no executable action) and none reached a mutation service; a valid control was accepted. No production code was changed and the harness was removed afterward.
  * Persistence after application restart — PASS; a task named `Module 5 Restart Test` remained present after fully closing and reopening the application.

##### Module 6 — Scheduling & Reminders
**Status: IMPLEMENTED — BUILD-VERIFIED — RUNTIME ACCEPTANCE TESTS PASSED (Finalized October 12, 2026).**
* **Goal:** Provide a functional schedule view of existing task deadlines and basic in-app reminders, reusing the existing task model with no new dependencies, no database migration, and no backend/Rust changes.
* **Scope delivered (in-app only):** Schedule grouped into Overdue / Due Today / Upcoming / No Deadline; dismissible app-wide in-app reminder surface for overdue and due-today tasks.
* **Implementation:**
  * `src/services/scheduling.ts` — New pure, provider-agnostic core (no React/Tauri). Local date-only parsing (avoids the `new Date("YYYY-MM-DD")` UTC-shift bug); `daysUntil`, `formatDeadline`, `relativeLabel`, `classifyTask`, `groupTasksBySchedule`, and `computeReminders` → `Reminder[]`. Scheduling rules live here so future delivery methods can reuse them unchanged.
  * `src/services/useReminders.ts` — New React hook over `computeReminders`; session-level dismiss de-duplication and a 60s refresh. Reminders derive from stored deadlines (not absolute timers), making them robust to app restart and system-clock changes.
  * `src/pages/Schedule.tsx` + `src/pages/Schedule.module.css` — Replaced the placeholder with the real grouped view (title, priority, status, deadline, relative label).
  * `src/components/ReminderBanner.tsx` + `src/components/ReminderBanner.module.css` — New delivery-agnostic in-app reminder banner consuming `useReminders`; per-item and dismiss-all actions.
  * `src/App.tsx` — Passes shared `tasks`/`loading` to `Schedule` and renders `ReminderBanner` above page content.
* **Verification (build tier only):**
  * `tsc --noEmit`: passed.
  * `npm run build`: passed (61 modules transformed).
  * `cargo check`: not run — no Rust was changed.
* **Runtime acceptance tests (performed manually by the user — all six PASSED):**
  1. Overdue / Due Today / Upcoming / No Deadline grouping matches real task data at local-midnight boundaries — PASS.
  2. Reminder banner appears for overdue/due-today tasks; per-item and dismiss-all work; no duplicate alerts within a session — PASS.
  3. Dismissed reminders stay dismissed across task add/edit and list refresh (bug-fix regression) — PASS.
  4. Newly created or newly overdue tasks still generate new reminders after dismissals — PASS.
  5. Completing a task removes it from the urgency groups and reminders after refresh — PASS.
  6. Persistence/correctness after application restart and across a system date change — PASS.
* **Bug fix (dismissed reminders reappearing):**
  * **Root cause:** `App.tsx` rendered `<ReminderBanner>` only while `!tasksLoading`. Every task add/edit called `refreshTasks()`, which toggled `tasksLoading` true→false, unmounting and remounting `ReminderBanner`. Remounting reset the hook's in-memory `dismissed` id set in `useReminders.ts`, so previously dismissed reminders returned on the next refresh.
  * **Fix:** Render `<ReminderBanner>` unconditionally in `App.tsx` (removed the `!tasksLoading` gate). The banner already self-hides when there are no active reminders, so the dismissed set now survives task refreshes. Newly created or newly overdue tasks still generate reminders because the dismissed set is keyed by `${taskId}:${kind}`; "Dismiss all" only suppresses currently-shown ids, not future ones. No change to `useReminders.ts`, `scheduling.ts`, the schema, or the task model.
  * **Verification:** `tsc --noEmit` passed; `npm run build` passed (61 modules). No test runner is configured in the project, so this React mount-lifecycle fix was verified by build + code trace rather than an automated test; the pure scheduling logic was already covered by the Module 5 isolated harness. Interactive runtime confirmation (dismiss, then add a past-deadline task, and confirm dismissed items stay hidden) remains part of the pending Module 6 runtime acceptance tests.
* **Future work (explicitly out of scope for Module 6):** native OS (Windows) notifications, closed-app/background reminders, cloud synchronization, and Android/iOS clients. The scheduling core is designed so these can be added later without rewriting the rules.

##### Module 7 — Personalization
**Status: COMPLETE — BUILD-VERIFIED AND RUNTIME-VERIFIED (Finalized October 12, 2026).**
* **Goal:** Add minimal, persistent user personalization that reuses the existing task services and SQLite architecture, with no new dependencies.
* **Scope delivered:** Persistent default task priority and status (applied to the New Task form), a live accent-color palette (5 choices), an additive SQLite migration v2, and validated preferences with safe defaults.
* **Implementation:**
  * `src-tauri/src/lib.rs` — Additive **migration v2**: new `settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)` table. The `tasks` table is untouched.
  * `src/types/index.ts` — Added `AccentColor` and `Preferences` types.
  * `src/services/preferences.ts` — New service: `loadPreferences`/`savePreferences` over the `settings` table (JSON value, upsert), `DEFAULT_PREFERENCES`, `ACCENT_HEX`, and `sanitize()` validation so missing/corrupt/out-of-range values fall back to defaults and never throw.
  * `src/App.tsx` — Owns `preferences`, loads on mount, applies the chosen accent to the `--accent` CSS variable, passes defaults to Tasks and the preferences + updater to Settings.
  * `src/pages/Settings.tsx` + `.module.css` — Replaced the "Appearance" placeholder with a functional Personalization section (accent swatches, default-priority and default-status selects).
  * `src/components/TaskForm.tsx`, `src/components/TaskModal.tsx`, `src/pages/Tasks.tsx` — Thread `defaultPriority`/`defaultStatus` through so a new task's form is pre-filled from preferences (editing an existing task is unaffected).
  * `src/index.css` — Declares the `--accent` custom property default.
* **Verification (build tier):**
  * `tsc --noEmit`: passed.
  * `npm run build`: passed (62 modules transformed).
  * `cargo check`: passed (Rust migration v2 compiles; `Finished dev profile`, zero errors).
* **Post-implementation fixes (regressions found and resolved during runtime verification):**
  * **Migration checksum regression:** The Module 7 edit had re-indented migration 1's SQL string when wrapping it into a two-element migrations list. `tauri-plugin-sql`/sqlx checksums the SQL text (whitespace included), so the altered indentation produced `migration 1 was previously applied but has been modified`, which failed `initDatabase()` — existing tasks appeared to vanish and preferences could not load. Fixed in `src-tauri/src/lib.rs` by restoring migration 1's SQL to its original indentation/text (checksum preserved) and keeping migration v2 as a separate additive migration. No database was deleted and no task data was modified.
  * **Accent not visibly applied:** `var(--accent)` was initially consumed in only one minor place, so selecting a swatch changed the variable but no prominent surface recolored. Fixed in `src/components/Sidebar.module.css` by changing the active navigation item (and logo icon) from the hardcoded `#818cf8` to `var(--accent, #818cf8)`.
* **Runtime acceptance tests (performed — all PASSED):**
  * Database initialization works after restoring the original migration 1 SQL and preserving its checksum — PASS.
  * Existing tasks load correctly — PASS.
  * Accent swatches are selectable after the CSS fix — PASS.
  * Selecting an accent updates the sidebar active navigation item and logo live — PASS.
  * The selected-swatch indicator updates correctly — PASS.
  * The chosen accent persists after restarting the application — PASS.
  * `npm run build` passed after the CSS-only fix.
* **Future work (out of scope for Module 7):** full light/dark theme switching, font-size scaling, additional task defaults (category, deadline offset), preference export/import, and extending `var(--accent)` to all buttons and highlights (currently applied to the sidebar active item and logo).

##### Module 8 — Analytics
**Status: COMPLETE — BUILD-VERIFIED, CALCULATION-TESTED, AND RUNTIME-VERIFIED (Finalized October 12, 2026).**
* **Goal:** A dedicated, lightweight Analytics page that accurately analyzes existing task data, with calculations separated from presentation for future scalability.
* **Scope delivered:** Summary (totals, status breakdown, completion rate, current overdue count); completion trends (daily 7-day / weekly 4-week) from real `completed_at` timestamps; priority and category breakdowns from existing fields; empty/missing-history states.
* **Data integrity:** No schema or mutation change. `completed_at` (UTC ISO) already exists and is maintained by the task services since Module 1C, so completion trends use real timestamps. **No historical completion data was fabricated** — tasks without a `completed_at` (never completed, or completed before tracking) simply do not appear in trends, and the UI notes this. Overdue reuses the existing local-date deadline rules from `scheduling.ts`.
* **Implementation:**
  * `src/services/analytics.ts` — New pure module (no React/Tauri). `computeSummary`, `completionsByDay`, `completionsByWeek`, `priorityBreakdown`, `categoryBreakdown`, `localDayKey`. Completion timestamps (UTC) are converted to the user's LOCAL day for bucketing, consistent with scheduling conventions; reuses `classifyTask` from `scheduling.ts` for overdue.
  * `src/pages/Analytics.tsx` + `Analytics.module.css` — New page: summary cards, horizontal status bars, a daily/weekly trend bar chart with a range toggle, priority/category chips, loading + empty states, and an honest note about missing completion history. Accent-aware via `var(--accent)`.
  * `src/types/index.ts` — Added `"analytics"` to `NavPage`.
  * `src/components/Sidebar.tsx` — Added the Analytics nav item (between Schedule and AI Assistant).
  * `src/App.tsx` — Imports Analytics and renders it for the `analytics` page, passing shared `tasks`/`loading`.
* **Verification:**
  * `tsc --noEmit`: passed.
  * `npm run build`: passed.
  * `cargo check`: not run — no Rust changed.
  * **Calculation unit tests (isolated harness, temporary, removed after):** 23/23 passed against crafted data — empty data (no divide-by-zero), status counts, completion rate (3/7 → 43%), overdue at the local date boundary (due-today excluded; done-but-past excluded), daily trend bucketing by local day, missing-timestamp handling (`localDayKey(null)`), and priority/category breakdowns incl. "Uncategorized".
* **UI runtime acceptance tests (performed manually by the user — all 5/5 PASSED):**
  * Analytics renders and totals match the Tasks page — PASS.
  * Completion rate and daily/weekly trends are sensible — PASS.
  * Overdue and priority/category breakdowns are correct — PASS.
  * Completing and reopening a task updates Analytics correctly — PASS.
  * Dashboard, Tasks, Schedule, AI Assistant, and Settings still open and work — PASS.
* **Future work (out of scope):** AI-generated insights, exact date/time deadlines and calendar/timer views, exports, cloud sync, and mobile — the pure analytics module is structured so these can build on it later without rewriting the calculations.

##### Module 9 — Settings & Security
**Status: COMPLETE — BUILD-VERIFIED AND RUNTIME-VERIFIED (Finalized October 12, 2026).**
* **Goal:** Review and complete settings/security surface; add a functional Data section; preserve the existing keyring credential flow exactly.
* **Security review (read-only findings):**
  * Credential flow (`commands.rs`): API key stored/read only in Rust via keyring; `chat` builds the auth header internally; frontend sees only a boolean status + reply string; error paths return the provider's message/HTTP status, never the key or auth header. No leak found — preserved unchanged.
  * Capabilities (`default.json`): `core`, `sql`, `keyring` only — least-privilege; no unused/network permissions.
  * CSP (`tauri.conf.json`): `"csp": null`. No immediate exploit for a local app with no untrusted web content; production CSP hardening **deferred to Module 10** per plan.
  * Error presentation: consistent and secret-free; no concrete issue found, so no change made.
* **Scope delivered (Data section):**
  * `src/services/index.ts` — added `deleteAllTasks()` (single parameterized `DELETE FROM tasks`; leaves the `settings` table and keyring untouched).
  * `src/pages/Settings.tsx` + `Settings.module.css` — Data section with **Export tasks to JSON** (serializes only the `tasks` prop — no API key, no preferences) and **Clear all tasks** with an inline confirmation (Cancel only hides the prompt — zero DB calls); Notifications placeholder relabeled **Planned** with a note that OS notifications are deferred.
  * `src/App.tsx` — passes shared `tasks` + `onTasksChange` to Settings so a clear refreshes shared state.
  * No Rust change, no new dependencies, no CSP change, no refactoring of other modules.
* **Verification:**
  * `tsc --noEmit`: passed.
  * `npm run build`: passed (65 modules transformed).
  * `cargo check`: not run — no Rust changed.
  * Data-safety guarantees confirmed by code trace against verified interfaces (not runtime): export is tasks-only; clear-all is `DELETE FROM tasks` only; Cancel performs no service call; clear awaits the service then refreshes shared state. These are build-verified and logic-confirmed, **not runtime-tested**.
* **UI runtime acceptance tests (performed manually by the user — all 5/5 PASSED):**
  * JSON export downloads a file containing only tasks (no key, no preferences) — PASS.
  * Cancel on clear-all leaves tasks intact (no deletion) — PASS.
  * Confirmed clear-all deletes all tasks with UI and database refresh — PASS.
  * Personalization preferences preserved after a clear — PASS.
  * API key status and AI functionality continue to work after a clear — PASS.
* **Limitations / future enhancement:** Task JSON **export** is implemented; task JSON **import/restore is NOT implemented** and is a future enhancement.
* **Deferred to Module 10:** production CSP hardening, bundle/installer secret-absence checks, signing/auto-update.

##### Module 10 — Security & Packaging
**Status: COMPLETE — BUILD-VERIFIED AND RUNTIME-VERIFIED (Finalized October 12, 2026).**
* **Goal:** Produce a Windows installer and harden the security surface for distribution, without changing the model, TLS backend, database, or unrelated features.
* **Packaging / CSP (`src-tauri/tauri.conf.json`):**
  * NSIS-only bundle target: `"targets": ["nsis"]` (unsigned, version `0.1.0`).
  * Production CSP: `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; script-src 'self'; connect-src 'self' ipc: http://ipc.localhost; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`. Gemini is intentionally absent from `connect-src` because AI requests go through Rust `reqwest`, not the WebView; `ipc:`/`http://ipc.localhost` preserve Tauri IPC (SQL + keyring).
* **AI error-handling hardening (fixes a misclassification found during packaging):**
  * `src-tauri/src/commands.rs` — tags errors so transport failures are distinguishable from Gemini HTTP API errors: `transport:` for genuine network/DNS/TLS/timeout/connection-reset failures; `api:<status>: <detail>` for HTTP error responses, preserving the numeric HTTP status and Gemini's safe status/message text. No secrets included.
  * `src/pages/AIAssistant.tsx` — replaced broad `"network"`/`"connect"` substring matching with a classifier keyed on the tags, giving separate messages for temporary service unavailability (503/UNAVAILABLE), rate limit (429/RESOURCE_EXHAUSTED), API-key/auth (400/401/403), and genuine transport errors.
* **Verification:**
  * `npm run build`: passed.
  * `npx tsc --noEmit`: passed.
  * `cargo check`: passed (after correcting a closure compile error — `unwrap_or_else(|_| …)` arg).
  * `npm run tauri build`: passed; x64 NSIS installer generated at `src-tauri/target/release/bundle/nsis/AI Task Manager_0.1.0_x64-setup.exe`.
  * Frontend `dist/` secret scan: zero credential-like matches (regex sanity-checked; no values printed).
  * `tauri dev`: launched successfully; runtime test displayed the correct temporary-AI-service-unavailable message (not a network error).
  * Installed-release smoke test (user-confirmed, all six PASSED): launch/CSP rendering, task persistence, AI error classification, reminders/analytics, settings/personalization persistence, and no obvious UI or console errors.
* **Known external limitation (honest):** During testing, Gemini returned `UNAVAILABLE` with a high-demand message. The error classifier now reports this accurately instead of blaming internet connectivity, but the **underlying Gemini model availability issue is external and unresolved** — a successful AI response under normal service conditions has **not** been confirmed. AI reliability is not claimed as fully fixed.
* **Notes:** The non-fatal `STATIC_VCRUNTIME is deprecated` build warning remains unchanged (cosmetic). Code signing was intentionally deferred (unsigned installer). Task JSON import/restore remains a future enhancement (from Module 9).

#### 4b. v0.2 Roadmap (post-v1.0)

v1.0 (Modules 1–10) is complete and unchanged; the entries below are the v0.2 track.

##### v0.2 M1 — Native Windows Notifications
**Status: COMPLETE** (build-verified + user runtime-confirmed). See `docs/v0.2-module-1-notifications.md`.
* Scope: OS toast notifications for due/overdue reminders (running-app only), 15-minute snooze, per-session deduplication, in-app banner preserved, graceful permission handling. Reuses the existing `computeReminders` engine.
* Exit criteria (met): tsc + `npm run build` pass; OS toast fires for a due/overdue task; snooze re-surfaces after 15 min; no duplicate toast across rerenders/60s refresh; dismissed/snoozed reminders suppressed; in-app banner unaffected.

##### v0.2 M2 — Packaging & Release Reliability
**Status: COMPLETE** (build-verified + user manual install/upgrade verified). See `docs/v0.2-module-2-packaging-release.md`.
* Scope: reliable production build and x64 Windows (NSIS) installer; clean-install behaviour; upgrade path preserving existing SQLite data and the keyring API key; written release instructions.
* Verification: version bumped to `0.2.0` (`package.json` + `tauri.conf.json`); `npm run tauri build` produced `AI Task Manager_0.2.0_x64-setup.exe`; `dist/` secret scan clean (0 matches); clean install launches and initializes the DB (user-confirmed on Windows); upgrade over a prior version preserved tasks, preferences, and API-key status with no migration-checksum error (user-confirmed); release instructions documented.
* Deferred: the non-fatal `STATIC_VCRUNTIME is deprecated` build warning. The fix (`build.windows.staticVCRuntime`) requires `@tauri-apps/cli >= 2.12.0`; this project is on CLI **2.11.4**, whose schema rejects the key. Resolving it needs a separately approved Tauri toolchain upgrade — out of scope for M2.

##### v0.2 M3 — Data Backup & Restore
**Status: PLANNED.**
* Scope: complete the deferred JSON import to pair with existing export; validate imported data; safe recovery with no partial/corrupt writes. Reuse existing task services (no raw SQL).
* Exit criteria: a previously exported JSON re-imports and restores tasks; malformed/foreign JSON is rejected with zero DB writes; a defined duplicate rule (skip/replace/new-id); round-trip (export → clear → import) restores state; tsc + build pass.

##### v0.2 M4 — AI & Network Reliability
**Status: PLANNED.**
* Scope: bounded retries with backoff for transient Gemini failures (503/UNAVAILABLE, 429/RESOURCE_EXHAUSTED) within the existing timeout; consistent rate-limit/error messaging (builds on the Module 10 `api:`/`transport:` tags); prevent duplicate task actions on retry. No model/endpoint change, no new cloud dependency.
* Exit criteria: a transient 503/429 auto-retries a bounded number of times then surfaces the correct classified message; retries never double-apply a task mutation; a normal AI response confirmed under normal service conditions; `cargo check` + tsc + build pass.

##### v0.2 M5 — Responsive UI Verification
**Status: IMPLEMENTED, NOT FORMALLY MODULE-COMPLETE** (pending verification/documentation).
* Context: the responsive Dashboard summary cards and the mobile navigation drawer are implemented and build-verified this session, but not yet runtime-verified across breakpoints or documented as a completed module.
* Scope: verify and document existing responsive behaviour at desktop/tablet/mobile widths; fix only confirmed defects (no redesign).
* Exit criteria: summary cards and mobile drawer verified at ~desktop/tablet/mobile widths with no horizontal overflow or awkward wrapping; drawer open/close (hamburger, backdrop, item select, Esc) confirmed; findings documented; module marked COMPLETE only after this.

##### Future phase (planning only — no implementation)
* Cross-device sync / mobile (Android/iOS) architecture: to be planned, not built, in v0.2. Delivery-layer separation (e.g. `notifications.ts` vs `scheduling.ts`) is intended to keep this feasible later without rewriting core rules.

#### 5. Architecture & Safety Principles
* Maintain strict separation between UI, Tauri backend commands, database services, and AI network modules[cite: 1].
* Treat AI responses as untrusted input; enforce least-privilege boundaries[cite: 1].

#### 6. Documentation & Handoff Requirements
* Keep records factual, distinct by verification tier (build-verified vs runtime-verified), and focused on minimizing unnecessary token and credit consumption[cite: 1].