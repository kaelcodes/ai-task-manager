import { useState, useMemo } from "react";
import type { Task, TaskFormData } from "../types";
import {
  createTask,
  updateTask,
  deleteTask,
  toggleTaskComplete,
} from "../services";
import TaskItem from "../components/TaskItem";
import TaskModal from "../components/TaskModal";
import shellStyles from "../components/PageShell.module.css";
import styles from "./Tasks.module.css";

interface TasksProps {
  /** Shared task list owned by App.tsx. */
  tasks: Task[];
  /** True while App.tsx is fetching tasks. */
  loading: boolean;
  /** Called after any mutation so App.tsx can re-fetch and push updates. */
  onTasksChange: () => Promise<void>;
  /** User-preferred default priority for new tasks (Module 7). */
  defaultPriority: Task["priority"];
  /** User-preferred default status for new tasks (Module 7). */
  defaultStatus: Task["status"];
}

export default function Tasks({
  tasks,
  loading,
  onTasksChange,
  defaultPriority,
  defaultStatus,
}: TasksProps) {
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search
  const [search, setSearch] = useState("");

  // ── Filtered list (in-memory search) ──────────────────────────────────────

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
    );
  }, [tasks, search]);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openCreate() {
    setEditingTask(undefined);
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setModalOpen(true);
  }

  function closeModal() {
    if (isSubmitting) return;
    setModalOpen(false);
    setEditingTask(undefined);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSubmit(data: TaskFormData) {
    setIsSubmitting(true);
    setError(null);
    try {
      if (editingTask) {
        await updateTask(editingTask.id, data, editingTask.created_at);
      } else {
        await createTask(data);
      }
      await onTasksChange();
      closeModal();
    } catch (err) {
      console.error("[Tasks] save failed:", err);
      setError(
        editingTask
          ? "Failed to update the task. Please try again."
          : "Failed to create the task. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleComplete(task: Task) {
    setError(null);
    try {
      await toggleTaskComplete(task);
      await onTasksChange();
    } catch (err) {
      console.error("[Tasks] toggleTaskComplete failed:", err);
      setError("Failed to update task status. Please try again.");
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    try {
      await deleteTask(id);
      await onTasksChange();
    } catch (err) {
      console.error("[Tasks] deleteTask failed:", err);
      setError("Failed to delete the task. Please try again.");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={shellStyles.page}>
      {/* Header */}
      <header className={shellStyles.header}>
        <h1 className={shellStyles.title}>Tasks</h1>
        <p className={shellStyles.subtitle}>
          {loading
            ? "Loading…"
            : `${tasks.length} task${tasks.length !== 1 ? "s" : ""}`}
        </p>
      </header>

      {/* Error banner */}
      {error && (
        <div
          className={shellStyles.errorBanner}
          role="alert"
          aria-live="assertive"
        >
          <span>{error}</span>
          <button
            className={shellStyles.errorDismiss}
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className={shellStyles.toolbar}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search tasks"
        />
        <button
          className={styles.btnNew}
          onClick={openCreate}
          aria-label="Create new task"
        >
          + New Task
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className={shellStyles.emptyState} aria-live="polite">
          <span className={shellStyles.emptyIcon} aria-hidden="true">◌</span>
          <p className={shellStyles.emptyText}>Loading tasks…</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className={shellStyles.emptyState}>
          {search ? (
            <>
              <span className={shellStyles.emptyIcon} aria-hidden="true">⊘</span>
              <p className={shellStyles.emptyText}>
                No tasks match &ldquo;{search}&rdquo;.
              </p>
            </>
          ) : (
            <>
              <span className={shellStyles.emptyIcon} aria-hidden="true">✓</span>
              <p className={shellStyles.emptyText}>No tasks yet.</p>
              <button className={styles.btnNewEmpty} onClick={openCreate}>
                Create your first task
              </button>
            </>
          )}
        </div>
      ) : (
        <ul className={styles.taskList} aria-label="Task list">
          {filteredTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggleComplete={handleToggleComplete}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}

      {/* Modal */}
      <TaskModal
        isOpen={modalOpen}
        editingTask={editingTask}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        onClose={closeModal}
        defaultPriority={defaultPriority}
        defaultStatus={defaultStatus}
      />
    </div>
  );
}
