import { useMemo } from "react";
import type { Task } from "../types";
import {
  groupTasksBySchedule,
  formatDeadline,
  relativeLabel,
} from "../services/scheduling";
import shellStyles from "../components/PageShell.module.css";
import styles from "./Schedule.module.css";

interface ScheduleProps {
  tasks: Task[];
  loading: boolean;
}

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

interface GroupProps {
  title: string;
  tasks: Task[];
  variant: "overdue" | "today" | "upcoming" | "muted";
  emptyText: string;
}

function ScheduleGroup({ title, tasks, variant, emptyText }: GroupProps) {
  return (
    <section className={shellStyles.section} aria-label={title}>
      <h2 className={shellStyles.sectionTitle}>
        {title} <span className={styles.count}>{tasks.length}</span>
      </h2>
      {tasks.length === 0 ? (
        <p className={styles.groupEmpty}>{emptyText}</p>
      ) : (
        <ul className={styles.list} aria-label={`${title} tasks`}>
          {tasks.map((task) => (
            <li key={task.id} className={styles.item}>
              <span
                className={`${styles.dot} ${styles[`dot_${variant}`]}`}
                aria-hidden="true"
              />
              <span className={styles.itemTitle}>{task.title}</span>
              <div className={styles.meta}>
                <span className={styles.priorityBadge}>
                  {PRIORITY_LABEL[task.priority]}
                </span>
                <span className={styles.statusBadge}>
                  {STATUS_LABEL[task.status]}
                </span>
                {task.deadline && (
                  <span
                    className={`${styles.deadline} ${variant === "overdue" ? styles.deadlineOverdue : ""}`}
                  >
                    ◷ {formatDeadline(task.deadline)} · {relativeLabel(task.deadline)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Schedule({ tasks, loading }: ScheduleProps) {
  const groups = useMemo(() => groupTasksBySchedule(tasks), [tasks]);

  const scheduledCount =
    groups.overdue.length + groups.today.length + groups.upcoming.length;

  return (
    <div className={shellStyles.page}>
      <header className={shellStyles.header}>
        <h1 className={shellStyles.title}>Schedule</h1>
        <p className={shellStyles.subtitle}>
          {loading
            ? "Loading…"
            : `${scheduledCount} scheduled task${scheduledCount !== 1 ? "s" : ""}`}
        </p>
      </header>

      {loading ? (
        <div className={shellStyles.emptyState} aria-live="polite">
          <span className={shellStyles.emptyIcon} aria-hidden="true">◌</span>
          <p className={shellStyles.emptyText}>Loading schedule…</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className={shellStyles.emptyState}>
          <span className={shellStyles.emptyIcon} aria-hidden="true">◷</span>
          <p className={shellStyles.emptyText}>No tasks to schedule yet.</p>
        </div>
      ) : (
        <>
          <ScheduleGroup
            title="Overdue"
            tasks={groups.overdue}
            variant="overdue"
            emptyText="Nothing overdue — nice."
          />
          <ScheduleGroup
            title="Due Today"
            tasks={groups.today}
            variant="today"
            emptyText="Nothing due today."
          />
          <ScheduleGroup
            title="Upcoming"
            tasks={groups.upcoming}
            variant="upcoming"
            emptyText="No upcoming deadlines."
          />
          {groups.noDeadline.length > 0 && (
            <ScheduleGroup
              title="No Deadline"
              tasks={groups.noDeadline}
              variant="muted"
              emptyText=""
            />
          )}
        </>
      )}
    </div>
  );
}
