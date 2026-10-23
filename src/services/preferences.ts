// Preferences service (Module 7) — persists user personalization in the
// SQLite `settings` key/value table (migration v2). Not secrets, so this does
// NOT use the keyring. All reads are validated against safe defaults so a
// missing, corrupt, or out-of-range stored value can never break the app.

import { getDatabase } from "../database";
import type {
  Preferences,
  Priority,
  TaskStatus,
  AccentColor,
} from "../types";

// ── Safe defaults ──────────────────────────────────────────────────────────────

export const DEFAULT_PREFERENCES: Preferences = {
  defaultPriority: "medium",
  defaultStatus: "todo",
  accentColor: "indigo",
};

/** Hex value applied to the --accent CSS variable for each palette entry. */
export const ACCENT_HEX: Record<AccentColor, string> = {
  indigo: "#818cf8",
  emerald: "#34d399",
  amber: "#fbbf24",
  rose: "#fb7185",
  sky: "#38bdf8",
};

const PRIORITIES: readonly Priority[] = ["low", "medium", "high"];
const STATUSES: readonly TaskStatus[] = ["todo", "in_progress", "done"];
const ACCENTS: readonly AccentColor[] = ["indigo", "emerald", "amber", "rose", "sky"];

const SETTINGS_KEY = "preferences";

// ── Validation ───────────────────────────────────────────────────────────────

/** Coerce an unknown parsed value into a valid Preferences, filling defaults. */
function sanitize(raw: unknown): Preferences {
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const priority = PRIORITIES.includes(obj.defaultPriority as Priority)
    ? (obj.defaultPriority as Priority)
    : DEFAULT_PREFERENCES.defaultPriority;
  const status = STATUSES.includes(obj.defaultStatus as TaskStatus)
    ? (obj.defaultStatus as TaskStatus)
    : DEFAULT_PREFERENCES.defaultStatus;
  const accent = ACCENTS.includes(obj.accentColor as AccentColor)
    ? (obj.accentColor as AccentColor)
    : DEFAULT_PREFERENCES.accentColor;
  return { defaultPriority: priority, defaultStatus: status, accentColor: accent };
}

// ── Load / Save ─────────────────────────────────────────────────────────────

interface SettingsRow {
  value: string;
}

/**
 * Load preferences from the settings table. Returns DEFAULT_PREFERENCES if no
 * row exists or if the stored value is malformed. Never throws for bad data.
 */
export async function loadPreferences(): Promise<Preferences> {
  try {
    const db = getDatabase();
    const rows = await db.select<SettingsRow[]>(
      "SELECT value FROM settings WHERE key = $1",
      [SETTINGS_KEY]
    );
    if (rows.length === 0) return { ...DEFAULT_PREFERENCES };
    return sanitize(JSON.parse(rows[0].value));
  } catch (err) {
    console.error("[preferences] load failed, using defaults:", err);
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Persist preferences (validated first) via an upsert into the settings table.
 */
export async function savePreferences(prefs: Preferences): Promise<Preferences> {
  const db = getDatabase();
  const safe = sanitize(prefs);
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [SETTINGS_KEY, JSON.stringify(safe)]
  );
  return safe;
}
