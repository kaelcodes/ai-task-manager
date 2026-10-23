import { useMemo, useState } from "react";
import type { Task } from "../types";
import {
  computeSummary,
  completionsByDay,
  completionsByWeek,
  priorityBreakdown,
  categoryBreakdown,
  type TrendPoint,
} from "../services/analytics";
import shellStyles from "../components/PageShell.module.css";
import styles from "./Analytics.module.css";

interface AnalyticsProps {
  tasks: Task[];
  loading: boolean;
}

const PRIORITY_LABEL: Record<"low" | "medium" | "high", string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function TrendChart({ points }: { points: TrendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const hasAny = points.some((p) => p.count > 0);
  return (
    <div className={styles.chart} role="img" aria-label="Completion trend">
      {points.map((p) => (
        <div key={p.date} className={styles.bar}>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{ height: `${(p.count / max) * 100}%` }}
              title={`${p.count} completed`}
            />
          </div>
          <span className={styles.barCount}>{p.count}</span>
          <span className={styles.barLabel}>{p.label}</span>
        </div>
      ))}
      {!hasAny && (
        <p className={styles.chartEmpty}>No completions recorded in this range.</p>
      )}
    </div>
  );
}

export default function Analytics({ tasks, loading }: AnalyticsProps) {
  const [trendMode, setTrendMode] = useState<"daily" | "weekly">("daily");

  const summary = useMemo(() => computeSummary(tasks), [tasks]);
  const trend = useMemo(
    () => (trendMode === "daily" ? completionsByDay(tasks, 7) : completionsByWeek(tasks, 4)),
    [tasks, trendMode]
  );
  const priorities = useMemo(() => priorityBreakdown(tasks), [tasks]);
  const categories = useMemo(() => categoryBreakdown(tasks), [tasks]);

  // Any completion history at all? Used to be honest about missing timestamps.
  const hasCompletionHistory = useMemo(
    () => tasks.some((t) => t.completed_at),
    [tasks]
  );

  if (loading) {
    return (
      <div className={shellStyles.page}>
        <header className={shellStyles.header}>
          <h1 className={shellStyles.title}>Analytics</h1>
        </header>
        <div className={shellStyles.emptyState} aria-live="polite">
          <span className={shellStyles.emptyIcon} aria-hidden="true">◌</span>
          <p className={shellStyles.emptyText}>Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className={shellStyles.page}>
        <header className={shellStyles.header}>
          <h1 className={shellStyles.title}>Analytics</h1>
          <p className={shellStyles.subtitle}>Insights from your task data.</p>
        </header>
        <div className={shellStyles.emptyState}>
          <span className={shellStyles.emptyIcon} aria-hidden="true">▦</span>
          <p className={shellStyles.emptyText}>No tasks yet — analytics will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={shellStyles.page}>
      <header className={shellStyles.header}>
        <h1 className={shellStyles.title}>Analytics</h1>
        <p className={shellStyles.subtitle}>Insights from your task data.</p>
      </header>

      {/* Summary stats */}
      <section className={shellStyles.section} aria-label="Summary">
        <h2 className={shellStyles.sectionTitle}>Summary</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total</span>
            <span className={styles.statValue}>{summary.total}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Completion Rate</span>
            <span className={styles.statValue}>{summary.completionRate}%</span>
            <span className={styles.statNote}>{summary.status.done} done</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>In Progress</span>
            <span className={styles.statValue}>{summary.status.in_progress}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Overdue</span>
            <span className={`${styles.statValue} ${summary.overdue > 0 ? styles.statDanger : ""}`}>
              {summary.overdue}
            </span>
            <span className={styles.statNote}>active, past deadline</span>
          </div>
        </div>
      </section>

      {/* Status breakdown */}
      <section className={shellStyles.section} aria-label="Status breakdown">
        <h2 className={shellStyles.sectionTitle}>Status Breakdown</h2>
        <div className={styles.barList}>
          {(["todo", "in_progress", "done"] as const).map((s) => {
            const count = summary.status[s];
            const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
            const label = s === "todo" ? "To Do" : s === "in_progress" ? "In Progress" : "Done";
            return (
              <div key={s} className={styles.barRow}>
                <span className={styles.barRowLabel}>{label}</span>
                <div className={styles.barRowTrack}>
                  <div className={`${styles.barRowFill} ${styles[`fill_${s}`]}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={styles.barRowValue}>{count} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Completion trend */}
      <section className={shellStyles.section} aria-label="Completion trend">
        <div className={styles.sectionHeader}>
          <h2 className={shellStyles.sectionTitle}>Completion Trend</h2>
          <div className={styles.toggle} role="group" aria-label="Trend range">
            <button
              className={`${styles.toggleBtn} ${trendMode === "daily" ? styles.toggleActive : ""}`}
              onClick={() => setTrendMode("daily")}
            >
              7 days
            </button>
            <button
              className={`${styles.toggleBtn} ${trendMode === "weekly" ? styles.toggleActive : ""}`}
              onClick={() => setTrendMode("weekly")}
            >
              4 weeks
            </button>
          </div>
        </div>
        <TrendChart points={trend} />
        {!hasCompletionHistory && (
          <p className={styles.note}>
            Completion trends use each task's recorded completion time. Tasks completed
            before this was tracked, or never marked done, do not appear here.
          </p>
        )}
      </section>

      {/* Priority breakdown */}
      <section className={shellStyles.section} aria-label="Priority breakdown">
        <h2 className={shellStyles.sectionTitle}>By Priority</h2>
        <div className={styles.chipRow}>
          {(["high", "medium", "low"] as const).map((p) => (
            <div key={p} className={styles.chip}>
              <span className={`${styles.chipDot} ${styles[`priority_${p}`]}`} aria-hidden="true" />
              {PRIORITY_LABEL[p]}
              <span className={styles.chipCount}>{priorities[p]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Category breakdown */}
      <section className={shellStyles.section} aria-label="Category breakdown">
        <h2 className={shellStyles.sectionTitle}>By Category</h2>
        <div className={styles.chipRow}>
          {categories.map((c) => (
            <div key={c.key} className={styles.chip}>
              {c.key}
              <span className={styles.chipCount}>{c.count}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
