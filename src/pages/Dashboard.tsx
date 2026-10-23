import { useMemo } from "react";
import type { Task } from "../types";
import shellStyles from "../components/PageShell.module.css";
import styles from "./Dashboard.module.css";

interface DashboardProps {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  onNavigateToTasks: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<Task["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const PRIORITY_CLASS: Record<Task["priority"], string> = {
  low: styles.priorityLow,
  medium: styles.priorityMedium,
  high: styles.priorityHigh,
};

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  low: "Low",
  medium: "Med",
  high: "High",
};

const STATUS_LABEL: Record<Task["status"], string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

function formatDeadline(deadline: string): string {
  const [year, month, day] = deadline.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(deadline: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = deadline.split("-").map(Number);
  return new Date(year, month - 1, day) < today;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard({
  tasks,
  loading,
  error,
  onNavigateToTasks,
}: DashboardProps) {
  // ── Statistics (derived, never hardcoded) ─────────────────────────────────
  const stats = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter((t) => t.status === "todo").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const done = tasks.filter((t) => t.status === "done").length;
    return { total, todo, inProgress, done };
  }, [tasks]);

  // ── Active tasks: unfinished, sorted high→low priority, capped at 8 ───────
  const activeTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== "done")
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
      .slice(0, 8);
  }, [tasks]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={shellStyles.page}>
      <header className={shellStyles.header}>
        <h1 className={shellStyles.title}>Dashboard</h1>
        <p className={shellStyles.subtitle}>
          {loading ? "Loading…" : "An overview of your tasks and activity."}
        </p>
      </header>

      {/* Error banner */}
      {error && (
        <div className={shellStyles.errorBanner} role="alert">
          <span>{error}</span>
        </div>
      )}

      {/* ── Statistics ───────────────────────────────────────────────────── */}
      <section className={shellStyles.section} aria-label="Task statistics">
        <h2 className={shellStyles.sectionTitle}>Summary</h2>

        {loading ? (
          <div className={styles.statsGrid}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`${styles.statCard} ${styles.statCardSkeleton}`} />
            ))}
          </div>
        ) : (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Total</span>
              <span className={styles.statValue}>{stats.total}</span>
              <span className={styles.statNote}>
                {stats.total === 1 ? "task" : "tasks"}
              </span>
            </div>

            <div className={`${styles.statCard} ${styles.statCardTodo}`}>
              <span className={styles.statLabel}>To Do</span>
              <span className={styles.statValue}>{stats.todo}</span>
              <span className={styles.statNote}>not started</span>
            </div>

            <div className={`${styles.statCard} ${styles.statCardInProgress}`}>
              <span className={styles.statLabel}>Active</span>
              <span className={styles.statValue}>{stats.inProgress}</span>
              <span className={styles.statNote}>in progress</span>
            </div>

            <div className={`${styles.statCard} ${styles.statCardDone}`}>
              <span className={styles.statLabel}>Done</span>
              <span className={styles.statValue}>{stats.done}</span>
              <span className={styles.statNote}>
                {stats.total > 0
                  ? `${Math.round((stats.done / stats.total) * 100)}% done`
                  : "complete"}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── Active tasks ─────────────────────────────────────────────────── */}
      <section className={shellStyles.section} aria-label="Active tasks">
        <div className={styles.sectionHeader}>
          <h2 className={shellStyles.sectionTitle}>Active Tasks</h2>
          <button
            className={styles.viewAllBtn}
            onClick={onNavigateToTasks}
            aria-label="View all tasks"
          >
            View all →
          </button>
        </div>

        {loading ? (
          <div className={styles.previewList}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={`${styles.previewItem} ${styles.previewItemSkeleton}`} />
            ))}
          </div>
        ) : activeTasks.length === 0 ? (
          <div className={shellStyles.emptyState}>
            {tasks.length === 0 ? (
              <>
                <span className={shellStyles.emptyIcon} aria-hidden="true">✓</span>
                <p className={shellStyles.emptyText}>No tasks yet.</p>
                <button
                  className={styles.createBtn}
                  onClick={onNavigateToTasks}
                >
                  Create your first task
                </button>
              </>
            ) : (
              <>
                <span className={shellStyles.emptyIcon} aria-hidden="true">🎉</span>
                <p className={shellStyles.emptyText}>
                  All tasks are done — great work!
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className={styles.previewList} aria-label="Active task list">
            {activeTasks.map((task) => {
              const overdue =
                task.deadline ? isOverdue(task.deadline) : false;
              return (
                <li key={task.id} className={styles.previewItem}>
                  {/* Priority dot */}
                  <span
                    className={`${styles.priorityDot} ${PRIORITY_CLASS[task.priority]}`}
                    aria-label={`Priority: ${task.priority}`}
                  />

                  {/* Title */}
                  <span className={styles.previewTitle}>{task.title}</span>

                  {/* Meta chips */}
                  <div className={styles.previewMeta}>
                    <span className={styles.priorityBadge}>
                      {PRIORITY_LABEL[task.priority]}
                    </span>
                    <span className={styles.statusBadge}>
                      {STATUS_LABEL[task.status]}
                    </span>
                    {task.deadline && (
                      <span
                        className={`${styles.deadlineBadge} ${overdue ? styles.deadlineOverdue : ""}`}
                        aria-label={`Deadline: ${formatDeadline(task.deadline)}${overdue ? ", overdue" : ""}`}
                      >
                        ◷ {formatDeadline(task.deadline)}
                        {overdue && " · overdue"}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
