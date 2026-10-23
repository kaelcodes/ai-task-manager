// Reusable in-app reminder hook.
//
// Thin React wrapper over the pure `computeReminders` scheduling logic. It owns
// only the session-level concern of which reminders the user has dismissed, so
// the same alert is not shown repeatedly. Delivery is intentionally generic:
// this returns reminder DATA plus a dismiss function; any surface (an in-app
// banner today, a Windows toast later) can consume it without changing rules.

import { useMemo, useState, useEffect, useRef } from "react";
import type { Task } from "../types";
import { computeReminders, type Reminder } from "./scheduling";
import { notifyReminders } from "./notifications";

export interface UseRemindersResult {
  /** Active reminders not yet dismissed or snoozed this session. */
  active: Reminder[];
  /** Dismiss a single reminder by its stable id (for the rest of the session). */
  dismiss: (id: string) => void;
  /** Dismiss all currently active reminders. */
  dismissAll: () => void;
  /** Snooze a reminder for 15 minutes; it may reappear/notify again if still due. */
  snooze: (id: string) => void;
}

/** Snooze duration: 15 minutes. */
const SNOOZE_MS = 15 * 60 * 1000;

/**
 * Recomputes reminders from the current task list. Because reminders are
 * derived from stored deadlines (not absolute timers), this is naturally
 * robust to app restarts and system clock changes — each render reflects the
 * real current date. An optional interval re-renders so a task can roll into
 * "due today"/"overdue" while the app stays open.
 */
export function useReminders(
  tasks: Task[],
  options: { refreshMs?: number } = {}
): UseRemindersResult {
  const refreshMs = options.refreshMs ?? 60_000;
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // reminderId -> epoch ms at which the snooze expires. Not persisted.
  const [snoozed, setSnoozed] = useState<Map<string, number>>(new Map());
  // A tick that advances on an interval to force recomputation over time.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (refreshMs <= 0) return;
    const id = setInterval(() => setTick((t) => t + 1), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  const active = useMemo(() => {
    // `tick` participates so the memo refreshes on the interval — this is also
    // what makes an expired snooze re-appear (the filter re-checks Date.now()).
    void tick;
    const now = Date.now();
    return computeReminders(tasks).filter((r) => {
      if (dismissed.has(r.id)) return false;
      const until = snoozed.get(r.id);
      if (until !== undefined && until > now) return false; // still snoozed
      return true;
    });
  }, [tasks, dismissed, snoozed, tick]);

  // ── OS notification delivery (v0.2) ─────────────────────────────────────────
  // Fire an OS toast once per reminder id per app session. Reuses the exact
  // `active` list (already excludes done + dismissed reminders), so dismissed
  // reminders never notify. The ref guards against duplicate delivery across
  // rerenders, the 60s refresh tick, and task refreshes.
  const notifiedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fresh = active.filter((r) => !notifiedIds.current.has(r.id));
    if (fresh.length === 0) return;
    for (const r of fresh) notifiedIds.current.add(r.id);
    void notifyReminders(fresh);
  }, [active]);

  return {
    active,
    dismiss: (id: string) =>
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      }),
    dismissAll: () =>
      setDismissed((prev) => {
        const next = new Set(prev);
        for (const r of computeReminders(tasks)) next.add(r.id);
        return next;
      }),
    snooze: (id: string) => {
      // Clear the notified-id so that, once the snooze expires and the
      // reminder re-enters `active`, it is treated as fresh and notifies again.
      notifiedIds.current.delete(id);
      setSnoozed((prev) => {
        const next = new Map(prev);
        next.set(id, Date.now() + SNOOZE_MS);
        return next;
      });
    },
  };
}
