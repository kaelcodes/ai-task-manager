# Module 9 — Settings & Security

**Status:** COMPLETE — BUILD-VERIFIED AND RUNTIME-VERIFIED
**Date:** October 12, 2026

## Scope

Review and complete the settings/security surface, and add a functional Data section — while preserving the existing Rust keyring credential flow exactly. No new dependencies, no Rust changes, no CSP changes.

Delivered:
- **Data → Export tasks (JSON):** downloads all tasks as a JSON file. Contains task records only — no API key, no preferences.
- **Data → Clear all tasks:** inline confirmation; confirming deletes all tasks and refreshes the UI/database; Cancel is a no-op (no database calls).
- **Notifications placeholder relabeled "Planned"**, with a note that OS (Windows) notifications are deferred to a later module.

## Security review (read-only findings)

- **Credential flow** (`src-tauri/src/commands.rs`): the API key is stored and read only in Rust via the keyring; the `chat` command builds the auth header internally; the frontend receives only a boolean key-status and the reply string. Error paths surface the provider's message / HTTP status, never the key or auth header. **No leak found — preserved unchanged.**
- **Capabilities** (`src-tauri/capabilities/default.json`): `core`, `sql`, `keyring` only — least-privilege; no unused or network permissions.
- **CSP** (`src-tauri/tauri.conf.json`): `"csp": null`. No immediate exploit for a local app serving no untrusted web content; production CSP hardening deferred to Module 10.
- **Error presentation:** consistent and secret-free; no concrete issue, so no change made.

## Architecture / changed files

| File | Change |
|---|---|
| `src/services/index.ts` | Added `deleteAllTasks()` — single parameterized `DELETE FROM tasks`; leaves the `settings` table (preferences) and the keyring untouched |
| `src/pages/Settings.tsx` | Data section: Export-to-JSON + Clear-all with inline confirm/cancel; Notifications relabeled "Planned" |
| `src/pages/Settings.module.css` | Styles for the inline clear-all confirmation controls |
| `src/App.tsx` | Passes shared `tasks` + `onTasksChange` to Settings so a clear refreshes shared state |

No Rust change, no new dependencies, no CSP change, no refactoring of other modules.

## Data safety

- Export serializes only the in-memory `tasks` list → never the API key (not in frontend state) and never preferences.
- Clear-all is `DELETE FROM tasks` only → the `settings` table and the OS-keyring API key are in separate stores and are untouched.
- Cancel performs zero database operations.

## Verification

- `tsc --noEmit`: passed.
- `npm run build`: passed (65 modules transformed).
- `cargo check`: not run (no Rust changed).
- **Manual desktop UI runtime acceptance tests (performed by the user): 5/5 passed** —
  1. JSON export downloads a tasks-only file (no key, no preferences).
  2. Cancel on clear-all leaves tasks intact (no deletion).
  3. Confirmed clear-all deletes all tasks with UI and database refresh.
  4. Personalization preferences preserved after a clear.
  5. API key status and AI functionality continue to work after a clear.

## Acceptance

All acceptance criteria met: security review completed (keyring flow preserved, least-privilege capabilities, no secret leaks), Data section functional, build-verified, and runtime-verified (5/5). No defects reported. **Module 9 is COMPLETE.**

## Limitations

- Task JSON **export is implemented; import/restore is NOT implemented** and is a future enhancement. The exported file is a backup/portability artifact only; the app cannot currently read it back in.
- Notifications remain in-app only; native OS notifications are planned for a later module.

## Future work

- Task JSON import/restore (read an exported file back into the database, with validation and conflict handling).
- Production CSP hardening, bundle/installer secret-absence verification, and signing/auto-update — deferred to Module 10 (Packaging).
