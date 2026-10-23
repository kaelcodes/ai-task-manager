// Scheduling & reminder logic — pure, provider-agnostic, UI-free.
//
// This module owns the core scheduling rules so that future delivery methods
// (in-app banners, native Windows notifications, cloud sync, mobile clients)
// can reuse the exact same grouping and due/overdue calculations without
// duplicating date logic. It must stay free of React and Tauri imports.
//
// Date handling: task deadlines are stored as date-only strings "YYYY-MM-DD".
// All comparisons parse them as LOCAL calendar dates (never via Date(string),
// which would interpret them as UTC and can shift the day). created_at /
// completed_at remain untouched ISO UTC datetimes and are not used here.

import type { Task } from "../types";

// ── Date-only helpers (local, no UTC drift) ───────────────────────────────────

/** Parse a "YYYY-MM-DD" string into a local Date at midnight, or null if invalid. */
export function parseLocalDate(deadline: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null;
  const [y, m, d] = deadline.split("-").map(Number);
  const dt = new Date(y, m - 1, d); // local midnight
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null; // rejects impossible dates like 2025-02-30
  }
  return dt;
}

/** Today's date at local midnight. Pass a reference date for testability. */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whole-day difference (deadline - today). Negative = past, 0 = today, >0 = future. */
export function daysUntil(deadline: string, now: Date = new Date()): number | null {
  const target = parseLocalDate(deadline);
  if (!target) return null;
  const today = startOfToday(now);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

/** Format a "YYYY-MM-DD" for display, e.g. "Oct 12, 2026". Falls back to raw on invalid. */
export function formatDeadline(deadline: string): string {
  const dt = parseLocalDate(deadline);
  if (!dt) return deadline;
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Human-friendly relative label: "Overdue by 2 days", "Today", "Tomorrow", "In 3 days". */
export function relativeLabel(deadline: string, now: Date = new Date()): string {
  const d = daysUntil(deadline, now);
  if (d === null) return deadline;
  if (d < -1) return `Overdue by ${Math.abs(d)} days`;
  if (d === -1) return "Overdue by 1 day";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
}

// ── Scheduling buckets ─────────────────────────────────────────────────────────

export type ScheduleBucket = "overdue" | "today" | "upcoming" | "no_deadline";

/** A task's schedule classification. Completed tasks are never overdue/today. */
export function classifyTask(task: Task, now: Date = new Date()): ScheduleBucket {
  if (!task.deadline) return "no_deadline";
  const done = task.status === "done";
  const d = daysUntil(task.deadline, now);
  if (d === null) return "no_deadline"; // unparseable deadline — treat as unscheduled
  if (done) {
    // A completed task is informational only; keep it off the urgency buckets.
    return d >= 0 ? "upcoming" : "overdue"; // retained for completeness; UI may hide done
  }
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  return "upcoming";
}

export interface GroupedSchedule {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  noDeadline: Task[];
}

/**
 * Group tasks into schedule buckets. By default completed tasks are excluded
 * from the urgency view (they are not actionable reminders). Within each dated
 * bucket, tasks are sorted by deadline ascending (soonest first); overdue is
 * sorted most-overdue first.
 */
export function groupTasksBySchedule(
  tasks: Task[],
  options: { includeDone?: boolean; now?: Date } = {}
): GroupedSchedule {
  const now = options.now ?? new Date();
  const includeDone = options.includeDone ?? false;

  const result: GroupedSchedule = { overdue: [], today: [], upcoming: [], noDeadline: [] };

  for (const task of tasks) {
    if (task.status === "done" && !includeDone) continue;

    if (!task.deadline || daysUntil(task.deadline, now) === null) {
      result.noDeadline.push(task);
      continue;
    }
    const bucket = classifyTask(task, now);
    if (bucket === "overdue") result.overdue.push(task);
    else if (bucket === "today") result.today.push(task);
    else result.upcoming.push(task);
  }

  const byDeadlineAsc = (a: Task, b: Task) =>
    (a.deadline ?? "").localeCompare(b.deadline ?? "");

  result.overdue.sort(byDeadlineAsc); // oldest (most overdue) first
  result.today.sort(byDeadlineAsc);
  result.upcoming.sort(byDeadlineAsc); // soonest first
  return result;
}

// ── Reminders (delivery-agnostic) ──────────────────────────────────────────────
//
// A Reminder is a plain data record describing something the user should be
// alerted about. It is intentionally decoupled from HOW it is delivered, so a
// future module can route these to an in-app banner, a Windows toast, a push
// notification, etc. without changing this logic.

export type ReminderKind = "overdue" | "due_today";

export interface Reminder {
  /** Stable id so delivery layers can de-duplicate (one alert per task+kind). */
  id: string;
  taskId: number;
  kind: ReminderKind;
  title: string;
  deadline: string;
  message: string;
}

/**
 * Compute the set of reminders that are currently relevant from the task list.
 * Only active (non-done) tasks that are overdue or due today produce reminders.
 * De-duplication key is `${taskId}:${kind}` via the `id` field.
 */
export function computeReminders(tasks: Task[], now: Date = new Date()): Reminder[] {
  const reminders: Reminder[] = [];
  for (const task of tasks) {
    if (task.status === "done" || !task.deadline) continue;
    const bucket = classifyTask(task, now);
    if (bucket === "overdue") {
      reminders.push({
        id: `${task.id}:overdue`,
        taskId: task.id,
        kind: "overdue",
        title: task.title,
        deadline: task.deadline,
        message: `"${task.title}" is ${relativeLabel(task.deadline, now).toLowerCase()}.`,
      });
    } else if (bucket === "today") {
      reminders.push({
        id: `${task.id}:due_today`,
        taskId: task.id,
        kind: "due_today",
        title: task.title,
        deadline: task.deadline,
        message: `"${task.title}" is due today.`,
      });
    }
  }
  return reminders;
}
