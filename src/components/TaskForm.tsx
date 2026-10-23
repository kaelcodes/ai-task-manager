import { useState, useEffect } from "react";
import type { Task, TaskFormData, Priority, TaskStatus } from "../types";
import styles from "./TaskForm.module.css";

interface TaskFormProps {
  /** When provided, the form is in edit mode and pre-populated. */
  initialData?: Task;
  onSubmit: (data: TaskFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  /** Preferred default priority for a new task (Module 7). */
  defaultPriority?: Task["priority"];
  /** Preferred default status for a new task (Module 7). */
  defaultStatus?: Task["status"];
}

/** Build the blank-form defaults for create mode, honoring user preferences. */
function emptyForm(
  priority: Task["priority"],
  status: Task["status"]
): TaskFormData {
  return {
    title: "",
    description: "",
    priority,
    status,
    category: "",
    deadline: "",
  };
}

function taskToFormData(task: Task): TaskFormData {
  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    status: task.status,
    category: task.category ?? "",
    deadline: task.deadline ?? "",
  };
}

export default function TaskForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  defaultPriority = "medium",
  defaultStatus = "todo",
}: TaskFormProps) {
  const [form, setForm] = useState<TaskFormData>(
    initialData ? taskToFormData(initialData) : emptyForm(defaultPriority, defaultStatus)
  );
  const [errors, setErrors] = useState<Partial<Record<keyof TaskFormData, string>>>({});

  // Re-populate if the task being edited changes (or defaults change for create).
  useEffect(() => {
    setForm(
      initialData ? taskToFormData(initialData) : emptyForm(defaultPriority, defaultStatus)
    );
    setErrors({});
  }, [initialData, defaultPriority, defaultStatus]);

  function setField<K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function validate(): boolean {
    const next: Partial<Record<keyof TaskFormData, string>> = {};
    const trimmedTitle = form.title.trim();

    if (trimmedTitle.length === 0) {
      next.title = "Title is required.";
    } else if (trimmedTitle.length > 200) {
      next.title = "Title must be 200 characters or fewer.";
    }

    if (form.category.trim().length > 50) {
      next.category = "Category must be 50 characters or fewer.";
    }

    if (form.deadline) {
      const parsed = Date.parse(form.deadline);
      if (isNaN(parsed)) {
        next.deadline = "Enter a valid date (YYYY-MM-DD).";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) {
      onSubmit(form);
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      noValidate
      aria-label={initialData ? "Edit task" : "Create task"}
    >
      {/* Title */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="task-title">
          Title <span className={styles.required} aria-hidden="true">*</span>
        </label>
        <input
          id="task-title"
          className={`${styles.input} ${errors.title ? styles.inputError : ""}`}
          type="text"
          value={form.title}
          onChange={(e) => setField("title", e.target.value)}
          placeholder="What needs to be done?"
          maxLength={210}
          aria-required="true"
          aria-describedby={errors.title ? "title-error" : undefined}
          autoFocus
        />
        {errors.title && (
          <span id="title-error" className={styles.errorMsg} role="alert">
            {errors.title}
          </span>
        )}
      </div>

      {/* Description */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="task-desc">
          Description
        </label>
        <textarea
          id="task-desc"
          className={styles.textarea}
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="Optional details…"
          rows={3}
        />
      </div>

      {/* Priority + Status row */}
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="task-priority">
            Priority
          </label>
          <select
            id="task-priority"
            className={styles.select}
            value={form.priority}
            onChange={(e) => setField("priority", e.target.value as Priority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="task-status">
            Status
          </label>
          <select
            id="task-status"
            className={styles.select}
            value={form.status}
            onChange={(e) => setField("status", e.target.value as TaskStatus)}
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      {/* Category + Deadline row */}
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="task-category">
            Category
          </label>
          <input
            id="task-category"
            className={`${styles.input} ${errors.category ? styles.inputError : ""}`}
            type="text"
            value={form.category}
            onChange={(e) => setField("category", e.target.value)}
            placeholder="e.g. Work, Personal"
            maxLength={55}
            aria-describedby={errors.category ? "category-error" : undefined}
          />
          {errors.category && (
            <span id="category-error" className={styles.errorMsg} role="alert">
              {errors.category}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="task-deadline">
            Deadline
          </label>
          <input
            id="task-deadline"
            className={`${styles.input} ${errors.deadline ? styles.inputError : ""}`}
            type="date"
            value={form.deadline}
            onChange={(e) => setField("deadline", e.target.value)}
            aria-describedby={errors.deadline ? "deadline-error" : undefined}
          />
          {errors.deadline && (
            <span id="deadline-error" className={styles.errorMsg} role="alert">
              {errors.deadline}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={styles.btnPrimary}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Saving…"
            : initialData
              ? "Save Changes"
              : "Create Task"}
        </button>
      </div>
    </form>
  );
}
