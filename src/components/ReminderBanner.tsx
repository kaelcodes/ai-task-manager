import type { Task } from "../types";
import { useReminders } from "../services/useReminders";
import styles from "./ReminderBanner.module.css";

interface ReminderBannerProps {
  tasks: Task[];
  /** Optional: jump to the Tasks page when a reminder is clicked. */
  onOpenTasks?: () => void;
}

/**
 * App-wide in-app reminder surface. Reads reminder DATA from the reusable
 * useReminders hook (which wraps the pure scheduling logic) and renders a
 * dismissible banner. Delivery method is deliberately swappable — a future
 * module can route the same reminders to Windows notifications without
 * touching this component or the scheduling rules.
 */
export default function ReminderBanner({ tasks, onOpenTasks }: ReminderBannerProps) {
  const { active, dismiss, dismissAll, snooze } = useReminders(tasks);

  if (active.length === 0) return null;

  const overdueCount = active.filter((r) => r.kind === "overdue").length;
  const todayCount = active.filter((r) => r.kind === "due_today").length;

  const summaryParts: string[] = [];
  if (overdueCount > 0) summaryParts.push(`${overdueCount} overdue`);
  if (todayCount > 0) summaryParts.push(`${todayCount} due today`);

  return (
    <div className={styles.banner} role="status" aria-label="Task reminders">
      <div className={styles.header}>
        <span className={styles.bell} aria-hidden="true">🔔</span>
        <span className={styles.summary}>
          {summaryParts.join(" · ")}
        </span>
        <button
          className={styles.dismissAll}
          onClick={dismissAll}
          aria-label="Dismiss all reminders"
        >
          Dismiss all
        </button>
      </div>

      <ul className={styles.list}>
        {active.slice(0, 5).map((r) => (
          <li key={r.id} className={styles.item}>
            <span
              className={`${styles.dot} ${r.kind === "overdue" ? styles.dotOverdue : styles.dotToday}`}
              aria-hidden="true"
            />
            <button
              className={styles.message}
              onClick={onOpenTasks}
              title={onOpenTasks ? "Open Tasks" : undefined}
            >
              {r.message}
            </button>
            <button
              className={styles.snoozeOne}
              onClick={() => snooze(r.id)}
              aria-label={`Snooze reminder for ${r.title} for 15 minutes`}
              title="Snooze 15 min"
            >
              Snooze
            </button>
            <button
              className={styles.dismissOne}
              onClick={() => dismiss(r.id)}
              aria-label={`Dismiss reminder for ${r.title}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {active.length > 5 && (
        <p className={styles.more}>+{active.length - 5} more</p>
      )}
    </div>
  );
}
