// Analytics calculations (Module 8) — pure, presentation-free.
//
// All metrics are derived from the existing Task records. Completion-trend
// logic uses the real `completed_at` timestamp (UTC ISO), converted to the
// user's LOCAL day so buckets match how the user perceives dates — consistent
// with the date-only/local conventions in scheduling.ts. Overdue reuses the
// same local-date deadline rules. This module must stay free of React/Tauri so
// future surfaces (richer reports, exports, mobile) can reuse it unchanged.

import type { Task, Priority, TaskStatus } from "../types";
import { classifyTask } from "./scheduling";

// ── Summary ────────────────────────────────────────────────────────────────

export interface StatusBreakdown {
  todo: number;
  in_progress: number;
  done: number;
}

export interface AnalyticsSummary {
  total: number;
  status: StatusBreakdown;
  /** Completed / total, as a 0–100 integer percentage. 0 when there are no tasks. */
  completionRate: number;
  /** Active (non-done) tasks whose deadline is before today (local). */
  overdue: number;
}

export function computeSummary(tasks: Task[], now: Date = new Date()): AnalyticsSummary {
  const status: StatusBreakdown = { todo: 0, in_progress: 0, done: 0 };
  let overdue = 0;

  for (const task of tasks) {
    if (task.status in status) status[task.status] += 1;
    if (task.status !== "done" && task.deadline) {
      if (classifyTask(task, now) === "overdue") overdue += 1;
    }
  }

  const total = tasks.length;
  const completionRate = total > 0 ? Math.round((status.done / total) * 100) : 0;

  return { total, status, completionRate, overdue };
}

// ── Completion trends (from real completed_at timestamps) ────────────────────

export interface TrendPoint {
  /** Local calendar day key, "YYYY-MM-DD". */
  date: string;
  /** Human label for the axis, e.g. "Oct 12". */
  label: string;
  /** Number of tasks whose completed_at falls on this local day. */
  count: number;
}

/** Convert a UTC ISO datetime to a local "YYYY-MM-DD" day key, or null if invalid. */
export function localDayKey(isoDateTime: string | null): string | null {
  if (!isoDateTime) return null;
  const d = new Date(isoDateTime); // ISO with offset/Z parses to a correct instant
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function shortLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Daily completion counts for the last `days` local days (inclusive of today),
 * oldest first. Only tasks with a parseable `completed_at` contribute; tasks
 * without a completion timestamp are simply absent (no fabricated history).
 */
export function completionsByDay(
  tasks: Task[],
  days = 7,
  now: Date = new Date()
): TrendPoint[] {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    const key = localDayKey(task.completed_at);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const points: TrendPoint[] = [];
  const base = startOfLocalDay(now);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    const key = localDayKey(d.toISOString())!; // d is a valid local date
    points.push({ date: key, label: shortLabel(d), count: counts.get(key) ?? 0 });
  }
  return points;
}

/**
 * Weekly completion counts for the last `weeks` local weeks (inclusive of the
 * current week), oldest first. Weeks are Monday-start in local time.
 */
export function completionsByWeek(
  tasks: Task[],
  weeks = 4,
  now: Date = new Date()
): TrendPoint[] {
  // Monday of the local week containing `now`.
  const base = startOfLocalDay(now);
  const dow = (base.getDay() + 6) % 7; // 0 = Monday
  const thisMonday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - dow);

  // Precompute week-start for each completed task.
  const weekCounts = new Map<string, number>();
  for (const task of tasks) {
    const key = localDayKey(task.completed_at);
    if (!key) continue;
    const [y, m, dd] = key.split("-").map(Number);
    const d = new Date(y, m - 1, dd);
    const wdow = (d.getDay() + 6) % 7;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - wdow);
    const mk = localDayKey(monday.toISOString())!;
    weekCounts.set(mk, (weekCounts.get(mk) ?? 0) + 1);
  }

  const points: TrendPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = new Date(
      thisMonday.getFullYear(),
      thisMonday.getMonth(),
      thisMonday.getDate() - i * 7
    );
    const mk = localDayKey(monday.toISOString())!;
    points.push({
      date: mk,
      label: `Wk of ${shortLabel(monday)}`,
      count: weekCounts.get(mk) ?? 0,
    });
  }
  return points;
}

// ── Category / priority breakdowns ───────────────────────────────────────────

export interface BreakdownEntry {
  key: string;
  count: number;
}

/** Count tasks by priority (low/medium/high), always returning all three keys. */
export function priorityBreakdown(tasks: Task[]): Record<Priority, number> {
  const out: Record<Priority, number> = { low: 0, medium: 0, high: 0 };
  for (const t of tasks) {
    if (t.priority in out) out[t.priority] += 1;
  }
  return out;
}

/**
 * Count tasks by category. Only categories that actually appear are returned
 * (no invented categories); tasks with no category are grouped as "Uncategorized".
 * Sorted by count descending.
 */
export function categoryBreakdown(tasks: Task[]): BreakdownEntry[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    const key = t.category && t.category.trim() ? t.category.trim() : "Uncategorized";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

// Re-export for presentation convenience without duplicating the type.
export type { Priority, TaskStatus };
