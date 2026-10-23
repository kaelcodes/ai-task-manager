import { useEffect, useRef } from "react";
import type { Task, TaskFormData } from "../types";
import TaskForm from "./TaskForm";
import styles from "./TaskModal.module.css";

interface TaskModalProps {
  isOpen: boolean;
  editingTask: Task | undefined;
  isSubmitting: boolean;
  onSubmit: (data: TaskFormData) => void;
  onClose: () => void;
  defaultPriority: Task["priority"];
  defaultStatus: Task["status"];
}

export default function TaskModal({
  isOpen,
  editingTask,
  isSubmitting,
  onSubmit,
  onClose,
  defaultPriority,
  defaultStatus,
}: TaskModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Trap focus within dialog when open
  useEffect(() => {
    if (isOpen) {
      // Small timeout lets the DOM paint before focusing
      const id = setTimeout(() => {
        const first = dialogRef.current?.querySelector<HTMLElement>(
          "input, textarea, select, button"
        );
        first?.focus();
      }, 40);
      return () => clearTimeout(id);
    }
  }, [isOpen, editingTask]);

  if (!isOpen) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  }

  return (
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-label={editingTask ? "Edit task" : "Create task"}
    >
      <div className={styles.panel} ref={dialogRef}>
        <header className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {editingTask ? "Edit Task" : "New Task"}
          </h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </header>

        <div className={styles.body}>
          <TaskForm
            initialData={editingTask}
            onSubmit={onSubmit}
            onCancel={onClose}
            isSubmitting={isSubmitting}
            defaultPriority={defaultPriority}
            defaultStatus={defaultStatus}
          />
        </div>
      </div>
    </div>
  );
}
