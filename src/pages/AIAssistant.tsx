import { useState, useEffect, useRef } from "react";
import type { Task } from "../types";
import {
  getApiKeyStatus,
  buildSystemPrompt,
  sendChat,
  parseReplyMulti,
  resolveTaskById,
  executeCreateTask,
  executeUpdateStatus,
  executeDeleteTask,
  type ChatMessage,
  type TaskAction,
  type CreateTaskAction,
  type DeleteTaskAction,
} from "../ai";
import shellStyles from "../components/PageShell.module.css";
import styles from "./AIAssistant.module.css";

interface AIAssistantProps {
  tasks: Task[];
  onTasksChange: () => Promise<void>;
  onNavigateToSettings: () => void;
}

const STATUS_LABEL: Record<Task["status"], string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

/**
 * Classify a chat error into a user-facing message.
 *
 * The Rust `chat` command tags errors so API/HTTP errors are never confused
 * with transport failures:
 *   - "no_api_key"            → key not configured
 *   - "transport: <detail>"   → genuine network/DNS/TLS/timeout failure
 *   - "api:<status>: <detail>"→ request reached Gemini; HTTP error status
 * We classify on these tags rather than fuzzy substring matching so an API
 * response that merely mentions "connection" is not mislabeled as an internet
 * problem.
 */
function classifyChatError(msg: string): string {
  if (msg === "no_api_key") {
    return "API key not found. Please configure it in Settings.";
  }

  if (msg.startsWith("transport:")) {
    return "Network error. Please check your internet connection.";
  }

  if (msg.startsWith("api:")) {
    // Shape: "api:<status>: <detail>"
    const rest = msg.slice("api:".length);
    const colon = rest.indexOf(":");
    const status = Number(rest.slice(0, colon));
    const detail = rest.slice(colon + 1).trim();

    // Temporary service unavailability (model overloaded / high demand).
    if (status === 503 || detail.toUpperCase().startsWith("UNAVAILABLE")) {
      return "The AI service is temporarily unavailable (high demand). Please try again in a moment.";
    }
    // Rate limit / quota exhausted.
    if (status === 429 || detail.toUpperCase().startsWith("RESOURCE_EXHAUSTED")) {
      return "AI request limit reached. Please wait a bit and try again.";
    }
    // Authentication / invalid key.
    if (status === 400 || status === 401 || status === 403) {
      return "The AI request was rejected. Please check your API key in Settings.";
    }
    // Other API errors: surface Gemini's own (secret-free) message.
    return `AI service error: ${detail}`;
  }

  // Unrecognized (should be rare) — show as a generic error, not a network one.
  return `Error: ${msg}`;
}

export default function AIAssistant({
  tasks,
  onTasksChange,
  onNavigateToSettings,
}: AIAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null); // null = checking
  const [error, setError] = useState<string | null>(null);

  // A single pending delete awaiting explicit user confirmation.
  const [pendingDelete, setPendingDelete] = useState<{ task: Task } | null>(null);
  // A notice shown after an action executes (success or failure).
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getApiKeyStatus()
      .then(setHasKey)
      .catch(() => setHasKey(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, pendingDelete, actionNotice]);

  function appendAssistant(text: string) {
    if (text.trim().length > 0) {
      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
    }
  }

  /**
   * Handle a validated action. create/status execute immediately; delete is
   * deferred to an explicit confirmation step. Success is reported only after
   * the service resolves. At most one action is processed per model reply
   * (the parser guarantees a single block); we never re-call the model here,
   * which bounds processing and prevents loops/duplicate mutations.
   */
  /**
   * Execute 1..N create_task actions sequentially, then refresh once.
   * Reports the real success/failure counts — never claims successes that
   * did not happen. Partial failure is possible (each create is independent);
   * the notice reflects exactly how many were created.
   */
  async function handleCreateBatch(creates: CreateTaskAction[]) {
    let created = 0;
    let failed = 0;
    for (const action of creates) {
      try {
        await executeCreateTask(action);
        created += 1;
      } catch (err) {
        console.error("[AIAssistant] create failed:", err);
        failed += 1;
      }
    }
    if (created > 0) await onTasksChange(); // refresh once after the batch

    if (failed === 0) {
      setActionNotice(`Created ${created} task${created !== 1 ? "s" : ""}.`);
    } else if (created === 0) {
      setActionNotice(
        `Failed to create ${failed} task${failed !== 1 ? "s" : ""}. Nothing was changed.`
      );
    } else {
      setActionNotice(
        `Created ${created} task${created !== 1 ? "s" : ""}; ${failed} failed.`
      );
    }
  }

  async function handleAction(action: TaskAction) {
    if (action.action === "update_task_status") {
      const resolved = resolveTaskById(tasks, action.task_id);
      if ("error" in resolved) {
        setActionNotice(resolved.error);
        return;
      }
      try {
        const updated = await executeUpdateStatus(resolved.task, action.status);
        await onTasksChange();
        setActionNotice(
          `Set “${updated.title}” to ${STATUS_LABEL[updated.status]}.`
        );
      } catch (err) {
        console.error("[AIAssistant] status update failed:", err);
        setActionNotice("Failed to update the task status. Nothing was changed.");
      }
      return;
    }

    if (action.action === "delete_task") {
      // Never auto-delete. Resolve the task and defer to explicit confirmation.
      const resolved = resolveTaskById(tasks, (action as DeleteTaskAction).task_id);
      if ("error" in resolved) {
        setActionNotice(resolved.error);
        return;
      }
      setPendingDelete({ task: resolved.task });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { task } = pendingDelete;
    setPendingDelete(null);
    try {
      await executeDeleteTask(task.id);
      await onTasksChange();
      setActionNotice(`Deleted task “${task.title}”.`);
    } catch (err) {
      console.error("[AIAssistant] delete failed:", err);
      setActionNotice("Failed to delete the task. Nothing was changed.");
    }
  }

  function cancelDelete() {
    // Zero mutation calls on cancellation.
    const title = pendingDelete?.task.title;
    setPendingDelete(null);
    setActionNotice(title ? `Cancelled. “${title}” was not deleted.` : "Cancelled.");
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];

    setMessages(nextMessages);
    setInput("");
    setError(null);
    setActionNotice(null);
    // A new instruction supersedes any un-confirmed delete.
    setPendingDelete(null);
    setIsLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(tasks);
      const reply = await sendChat(nextMessages, systemPrompt);

      const { text, actions, validationError } = parseReplyMulti(reply);

      // Always show the conversational text first.
      appendAssistant(text);

      if (validationError) {
        setActionNotice(`I couldn't perform that action: ${validationError}`);
      } else if (actions.length > 0) {
        // parseReplyMulti guarantees the batch is either all create_task, or a
        // single status/delete action — never mixed.
        if (actions.every((a) => a.action === "create_task")) {
          await handleCreateBatch(actions as CreateTaskAction[]);
        } else {
          await handleAction(actions[0]);
        }
      }
    } catch (err) {
      const msg = typeof err === "string" ? err : String(err);
      if (msg === "no_api_key") {
        setHasKey(false);
      }
      setError(classifyChatError(msg));
      setMessages(messages);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  // ── No API key state ────────────────────────────────────────────────────────
  if (hasKey === false) {
    return (
      <div className={shellStyles.page}>
        <header className={shellStyles.header}>
          <h1 className={shellStyles.title}>AI Assistant</h1>
          <p className={shellStyles.subtitle}>Powered by Gemini</p>
        </header>
        <div className={shellStyles.emptyState}>
          <span className={shellStyles.emptyIcon} aria-hidden="true">✦</span>
          <p className={shellStyles.emptyText}>No API key configured.</p>
          <p className={styles.noKeyHint}>
            Add your Gemini API key in Settings to start chatting.
          </p>
          <button className={styles.btnGoSettings} onClick={onNavigateToSettings}>
            Open Settings
          </button>
        </div>
      </div>
    );
  }

  // ── Loading key status ──────────────────────────────────────────────────────
  if (hasKey === null) {
    return (
      <div className={shellStyles.page}>
        <header className={shellStyles.header}>
          <h1 className={shellStyles.title}>AI Assistant</h1>
        </header>
        <div className={shellStyles.emptyState} aria-live="polite">
          <span className={shellStyles.emptyIcon} aria-hidden="true">◌</span>
          <p className={shellStyles.emptyText}>Checking configuration…</p>
        </div>
      </div>
    );
  }

  // ── Chat UI ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.chatPage}>
      <header className={styles.chatHeader}>
        <div>
          <h1 className={shellStyles.title} style={{ marginBottom: 0 }}>
            AI Assistant
          </h1>
          <p className={shellStyles.subtitle}>
            Chat, or ask me to create, update, or delete tasks.
          </p>
        </div>
      </header>

      <div className={styles.thread} aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && (
          <div className={styles.emptyThread}>
            <span className={styles.emptyIcon} aria-hidden="true">✦</span>
            <p className={styles.emptyPrompt}>
              Ask about your tasks, or tell me to add, update, or remove one.
            </p>
            <p className={styles.emptyNote}>
              I'll always ask you to confirm before deleting anything.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.bubble} ${msg.role === "user" ? styles.bubbleUser : styles.bubbleAssistant}`}
            aria-label={msg.role === "user" ? "Your message" : "Assistant message"}
          >
            <span className={styles.bubbleRole}>
              {msg.role === "user" ? "You" : "Assistant"}
            </span>
            <p className={styles.bubbleContent}>{msg.content}</p>
          </div>
        ))}

        {isLoading && (
          <div className={`${styles.bubble} ${styles.bubbleAssistant}`} aria-label="Assistant is thinking">
            <span className={styles.bubbleRole}>Assistant</span>
            <span className={styles.typingDots} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}

        {/* Delete confirmation — the model cannot approve its own deletion */}
        {pendingDelete && (
          <div className={styles.confirmCard} role="alertdialog" aria-label="Confirm task deletion">
            <p className={styles.confirmText}>
              Delete this task? This cannot be undone.
            </p>
            <div className={styles.confirmTaskRow}>
              <span className={styles.confirmTaskTitle}>{pendingDelete.task.title}</span>
              <span className={styles.confirmTaskMeta}>
                {pendingDelete.task.priority} · {STATUS_LABEL[pendingDelete.task.status]}
                {pendingDelete.task.deadline ? ` · due ${pendingDelete.task.deadline}` : ""}
              </span>
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.btnCancel} onClick={cancelDelete}>
                Cancel
              </button>
              <button className={styles.btnConfirmDelete} onClick={() => void confirmDelete()}>
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Action result notice */}
        {actionNotice && (
          <div className={styles.actionNotice} role="status">
            {actionNotice}
          </div>
        )}

        {error && (
          <div className={styles.errorRow} role="alert">
            <span>{error}</span>
            <button
              className={styles.errorDismiss}
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className={styles.inputBar}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about or manage your tasks… (Enter to send, Shift+Enter for new line)"
          rows={1}
          disabled={isLoading}
          aria-label="Message input"
        />
        <button
          className={styles.sendBtn}
          onClick={() => void handleSend()}
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
        >
          {isLoading ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
