// Shared TypeScript types and interfaces

export type NavPage =
  | "dashboard"
  | "tasks"
  | "schedule"
  | "analytics"
  | "assistant"
  | "settings";

// ── Task domain ──────────────────────────────────────────────────────────────

export type Priority = "low" | "medium" | "high";

export type TaskStatus = "todo" | "in_progress" | "done";

/** Shape returned by the database for every task row. */
export interface Task {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  category: string | null;
  deadline: string | null;          // YYYY-MM-DD or null
  estimated_duration: number | null;
  created_at: string;               // ISO 8601 datetime (UTC)
  completed_at: string | null;      // ISO 8601 datetime (UTC) or null
}

/**
 * Data collected by the task form.
 * Empty strings for optional fields are normalised to null before writing.
 */
export interface TaskFormData {
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  category: string;
  deadline: string;                 // YYYY-MM-DD or ""
}

// ── Personalization (Module 7) ────────────────────────────────────────────────

/** Accent colors offered in Settings. Kept as a fixed, validated palette. */
export type AccentColor = "indigo" | "emerald" | "amber" | "rose" | "sky";

/** User preferences, persisted in the SQLite `settings` table (key/value). */
export interface Preferences {
  defaultPriority: Priority;
  defaultStatus: TaskStatus;
  accentColor: AccentColor;
}

// ── Backup / restore (v0.2 M3) ─────────────────────────────────────────────────

/** Backup envelope for tasks-only export/import. No credentials/preferences. */
export interface TaskBackup {
  app: "ai-task-manager";
  schemaVersion: number;
  exportedAt: string; // ISO timestamp
  tasks: Task[];
}
