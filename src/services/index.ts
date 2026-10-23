// Services layer — CRUD operations for the tasks table.

import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "../database";
import type { Task, TaskFormData } from "../types";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise an empty string to null for optional text columns. */
function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Return an ISO 8601 UTC datetime string for the current moment. */
function nowIso(): string {
  return new Date().toISOString();
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all tasks ordered by creation date descending.
 */
export async function fetchTasks(): Promise<Task[]> {
  const db = getDatabase();
  return db.select<Task[]>(
    "SELECT * FROM tasks ORDER BY created_at DESC"
  );
}

// ── Create ───────────────────────────────────────────────────────────────────

/**
 * Insert a new task and return the complete saved row.
 */
export async function createTask(data: TaskFormData): Promise<Task> {
  const db = getDatabase();
  const now = nowIso();
  const completedAt =
    data.status === "done" ? now : null;

  const result = await db.execute(
    `INSERT INTO tasks
       (title, description, priority, status, category, deadline,
        estimated_duration, created_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      data.title.trim(),
      nullIfEmpty(data.description),
      data.priority,
      data.status,
      nullIfEmpty(data.category),
      nullIfEmpty(data.deadline),
      null,           // estimated_duration — reserved for a later module
      now,
      completedAt,
    ]
  );

  // Reconstruct the full Task from the form data + generated fields.
  return {
    id: result.lastInsertId as number,
    title: data.title.trim(),
    description: nullIfEmpty(data.description),
    priority: data.priority,
    status: data.status,
    category: nullIfEmpty(data.category),
    deadline: nullIfEmpty(data.deadline),
    estimated_duration: null,
    created_at: now,
    completed_at: completedAt,
  };
}

// ── Update ───────────────────────────────────────────────────────────────────

/**
 * Update an existing task's fields and return the updated row.
 * completed_at is set to now when status becomes "done",
 * and cleared when status leaves "done".
 */
export async function updateTask(
  id: number,
  data: TaskFormData,
  existingCreatedAt: string
): Promise<Task> {
  const db = getDatabase();
  const completedAt =
    data.status === "done" ? nowIso() : null;

  await db.execute(
    `UPDATE tasks
     SET title              = $1,
         description        = $2,
         priority           = $3,
         status             = $4,
         category           = $5,
         deadline           = $6,
         completed_at       = $7
     WHERE id = $8`,
    [
      data.title.trim(),
      nullIfEmpty(data.description),
      data.priority,
      data.status,
      nullIfEmpty(data.category),
      nullIfEmpty(data.deadline),
      completedAt,
      id,
    ]
  );

  return {
    id,
    title: data.title.trim(),
    description: nullIfEmpty(data.description),
    priority: data.priority,
    status: data.status,
    category: nullIfEmpty(data.category),
    deadline: nullIfEmpty(data.deadline),
    estimated_duration: null,
    created_at: existingCreatedAt,
    completed_at: completedAt,
  };
}

// ── Delete ───────────────────────────────────────────────────────────────────

/**
 * Permanently remove a task by id.
 */
export async function deleteTask(id: number): Promise<void> {
  const db = getDatabase();
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
}

/**
 * Permanently remove ALL tasks. Only the tasks table is affected — the
 * settings table (preferences) and the OS-keyring API key are untouched.
 * Destructive: callers must obtain explicit user confirmation first.
 */
export async function deleteAllTasks(): Promise<void> {
  const db = getDatabase();
  await db.execute("DELETE FROM tasks");
}

// ── Completion toggle ────────────────────────────────────────────────────────

/**
 * Toggle a task between "done" and "todo".
 * Returns the updated Task.
 */
export async function toggleTaskComplete(task: Task): Promise<Task> {
  const db = getDatabase();
  const nowDone = task.status !== "done";
  const newStatus = nowDone ? "done" : "todo";
  const completedAt = nowDone ? nowIso() : null;

  await db.execute(
    "UPDATE tasks SET status = $1, completed_at = $2 WHERE id = $3",
    [newStatus, completedAt, task.id]
  );

  return { ...task, status: newStatus, completed_at: completedAt };
}

// ── Backup / restore (v0.2 M3) ─────────────────────────────────────────────────

import type { TaskBackup, Priority, TaskStatus } from "../types";

/** Schema version this build understands (matches migration v2). */
export const BACKUP_SCHEMA_VERSION = 2;

const PRIORITIES: readonly Priority[] = ["low", "medium", "high"];
const STATUSES: readonly TaskStatus[] = ["todo", "in_progress", "done"];

/**
 * Build the versioned, tasks-only backup envelope. Contains NO API key and
 * NO preferences — tasks only, by design.
 */
export function exportTasksEnvelope(tasks: Task[]): TaskBackup {
  return {
    app: "ai-task-manager",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: nowIso(),
    tasks,
  };
}

/** A task validated for import. Only the fields we re-insert are kept. */
export interface ImportTaskInput {
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  category: string | null;
  deadline: string | null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidDeadline(s: string): boolean {
  if (s === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Validate a raw JSON string into importable tasks. Returns either a list of
 * sanitized tasks (imported ids are DISCARDED — new ids are generated at
 * insert time) or a single clear error. Performs whole-file validation: any
 * invalid row fails the entire import so no partial/garbage data is written.
 */
export function parseTaskBackup(
  text: string
): { tasks: ImportTaskInput[] } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "That is not valid JSON." };
  }
  if (!isObject(parsed)) {
    return { error: "Backup must be a JSON object." };
  }
  if (parsed.app !== "ai-task-manager") {
    return { error: "This file is not an AI Task Manager backup." };
  }
  if (typeof parsed.schemaVersion !== "number") {
    return { error: "Backup is missing a valid schemaVersion." };
  }
  if (parsed.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return {
      error: `Backup schema v${parsed.schemaVersion} is newer than this app supports (v${BACKUP_SCHEMA_VERSION}). Update the app to import it.`,
    };
  }
  if (!Array.isArray(parsed.tasks)) {
    return { error: "Backup has no tasks array." };
  }

  const out: ImportTaskInput[] = [];
  for (let i = 0; i < parsed.tasks.length; i++) {
    const raw = parsed.tasks[i];
    const n = i + 1;
    if (!isObject(raw)) return { error: `Task #${n} is not an object.` };

    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (title.length === 0) return { error: `Task #${n} is missing a title.` };
    if (title.length > 200) return { error: `Task #${n} title exceeds 200 characters.` };

    if (!(PRIORITIES as readonly string[]).includes(raw.priority as string)) {
      return { error: `Task #${n} has an invalid priority.` };
    }
    if (!(STATUSES as readonly string[]).includes(raw.status as string)) {
      return { error: `Task #${n} has an invalid status.` };
    }

    const category = typeof raw.category === "string" ? raw.category.trim() : "";
    if (category.length > 50) return { error: `Task #${n} category exceeds 50 characters.` };

    const description = typeof raw.description === "string" ? raw.description : "";

    const deadlineRaw = typeof raw.deadline === "string" ? raw.deadline.trim() : "";
    if (!isValidDeadline(deadlineRaw)) {
      return { error: `Task #${n} has an invalid deadline (use YYYY-MM-DD).` };
    }

    out.push({
      title,
      description: description.trim() || null,
      priority: raw.priority as Priority,
      status: raw.status as TaskStatus,
      category: category || null,
      deadline: deadlineRaw || null,
    });
  }

  return { tasks: out };
}

/**
 * Atomically insert validated tasks as NEW rows (new auto-increment ids;
 * imported ids are ignored). Existing tasks are never touched.
 *
 * Atomicity is handled by the Rust `import_tasks` command, which runs all
 * inserts inside a single SQLite transaction (commit on success, rollback on
 * any error). The `@tauri-apps/plugin-sql` JS `execute` cannot do this: with
 * bound parameters it runs a prepared statement, which executes only the first
 * statement of a multi-statement string — so a JS-side BEGIN/…/COMMIT is not
 * atomic (and does not even run the inserts). Hence the dedicated command.
 *
 * Returns the number of rows inserted.
 */
export async function importTasksAtomic(tasks: ImportTaskInput[]): Promise<number> {
  if (tasks.length === 0) return 0;
  return invoke<number>("import_tasks", { tasks });
}
