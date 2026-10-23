import { useState } from "react";
import type { Task } from "../types";
import styles from "./TaskItem.module.css";

interface TaskItemProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
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

/** Format a YYYY-MM-DD deadline string for display. */
function formatDeadline(deadline: string): string {
  // Parse as local date to avoid UTC-offset day shift
  const [year, month, day] = deadline.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Return true if a YYYY-MM-DD deadline is strictly before today. */
function isOverdue(deadline: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = deadline.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d < today;
}

export default function TaskItem({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
}: TaskItemProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isDone = task.status === "done";

  function handleDeleteClick() {
    setConfirmingDelete(true);
  }

  function handleConfirmDelete() {
    setConfirmingDelete(false);
    onDelete(task.id);
  }

  function handleCancelDelete() {
    setConfirmingDelete(false);
  }

  const overdue =
    task.deadline && !isDone ? isOverdue(task.deadline) : false;

  return (
    <li className={`${styles.item} ${isDone ? styles.itemDone : ""}`}>
      {/* Completion checkbox */}
      <button
        className={styles.checkbox}
        role="checkbox"
        aria-checked={isDone}
        aria-label={isDone ? "Mark as not done" : "Mark as done"}
        onClick={() => onToggleComplete(task)}
      >
        {isDone && (
          <span className={styles.checkmark} aria-hidden="true">✓</span>
        )}
      </button>

      {/* Main content */}
      <div className={styles.content}>
        <span className={`${styles.title} ${isDone ? styles.titleDone : ""}`}>
          {task.title}
        </span>

        <div className={styles.meta}>
          {/* Priority */}
          <span
            className={`${styles.badge} ${styles[`priority_${task.priority}`]}`}
            aria-label={`Priority: ${task.priority}`}
          >
            {PRIORITY_LABEL[task.priority]}
          </span>

          {/* Status */}
          <span className={styles.statusChip}>
            {STATUS_LABEL[task.status]}
          </span>

          {/* Category */}
          {task.category && (
            <span className={styles.categoryChip}>{task.category}</span>
          )}

          {/* Deadline */}
          {task.deadline && (
            <span
              className={`${styles.deadline} ${overdue ? styles.deadlineOverdue : ""}`}
              aria-label={`Deadline: ${formatDeadline(task.deadline)}${overdue ? ", overdue" : ""}`}
            >
              ◷ {formatDeadline(task.deadline)}
              {overdue && " · overdue"}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {confirmingDelete ? (
          <div className={styles.confirmRow} role="group" aria-label="Confirm deletion">
            <span className={styles.confirmPrompt}>Delete?</span>
            <button
              className={styles.btnDanger}
              onClick={handleConfirmDelete}
              aria-label="Confirm delete"
            >
              Yes
            </button>
            <button
              className={styles.btnGhost}
              onClick={handleCancelDelete}
              aria-label="Cancel delete"
            >
              No
            </button>
          </div>
        ) : (
          <>
            <button
              className={styles.btnGhost}
              onClick={() => onEdit(task)}
              aria-label={`Edit task: ${task.title}`}
            >
              Edit
            </button>
            <button
              className={styles.btnGhost}
              onClick={handleDeleteClick}
              aria-label={`Delete task: ${task.title}`}
            >
              ✕
            </button>
          </>
        )}
      </div>
    </li>
  );
}
