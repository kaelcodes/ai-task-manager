// AI layer — Tauri command wrappers for credential management and chat,
// plus Module 5 structured task-action parsing/validation/execution.
// The API key is stored in and used from the Rust backend only.
// The frontend never receives the key value.

import { invoke } from "@tauri-apps/api/core";
import type { Task, TaskFormData, Priority, TaskStatus } from "../types";
import { createTask, updateTask, deleteTask } from "../services";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Credential commands ───────────────────────────────────────────────────────

/**
 * Save the API key to the OS credential store via Rust.
 * Throws a string error message on failure.
 */
export async function saveApiKey(key: string): Promise<void> {
  await invoke<void>("save_api_key", { key });
}

/**
 * Returns true if an API key is currently stored, false otherwise.
 * Never returns the key itself.
 */
export async function getApiKeyStatus(): Promise<boolean> {
  return invoke<boolean>("get_api_key_status");
}

/**
 * Remove the stored API key from the OS credential store.
 * Throws a string error message on failure.
 */
export async function deleteApiKey(): Promise<void> {
  await invoke<void>("delete_api_key");
}

// ── System prompt ─────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<Task["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Build the system prompt: read-only task context plus the Module 5
 * structured-action specification. Up to 20 tasks are listed with their
 * real IDs so the model can reference them for status/delete actions.
 */
export function buildSystemPrompt(tasks: Task[]): string {
  const total = tasks.length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "done").length;

  // List tasks with real IDs, active first (by priority), capped at 20.
  const listed = [...tasks]
    .sort((a, b) => {
      const aDone = a.status === "done" ? 1 : 0;
      const bDone = b.status === "done" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    })
    .slice(0, 20);

  const taskList =
    listed.length > 0
      ? listed
          .map(
            (t) =>
              `- id=${t.id} | "${t.title}" | priority=${t.priority} | status=${t.status}${t.deadline ? ` | due=${t.deadline}` : ""}`
          )
          .join("\n")
      : "No tasks exist yet.";

  return `You are a task management assistant inside a local desktop app called AI Task Manager.

TASK SUMMARY:
- Total: ${total} | To do: ${todo} | In progress: ${inProgress} | Done: ${done}

TASKS (up to 20, with real ids):
${taskList}

You can either reply conversationally OR request ONE task operation. To request an operation, end your reply with a single fenced code block containing exactly one JSON object:

\`\`\`json
{ "action": "create_task", "title": "...", "description": "", "priority": "low|medium|high", "status": "todo|in_progress|done", "category": "", "deadline": "YYYY-MM-DD or empty" }
\`\`\`
\`\`\`json
{ "action": "update_task_status", "task_id": 123, "status": "todo|in_progress|done" }
\`\`\`
\`\`\`json
{ "action": "delete_task", "task_id": 123 }
\`\`\`

ACTION RULES:
- Only use ids that appear in the TASKS list above. Never invent an id.
- For create_task, only "title" is required; omit or leave other fields empty if the user did not specify them.
- You MAY emit multiple create_task blocks in one reply (up to 10) when the user asks to add several tasks — one JSON block per task.
- update_task_status and delete_task are single-action: emit at most ONE, and never mix them with create_task or with each other in the same reply.
- If the user's request is ambiguous (e.g. the task they mean is unclear or multiple match), DO NOT emit an action. Ask a clarifying question instead.
- deletion will require explicit user confirmation in the app; still emit the delete_task action and the app will handle the confirmation.
- Put a short natural-language sentence before the JSON block describing what you are about to do.
- For pure questions, advice, or chat, DO NOT emit any JSON block.`;
}

// ── Module 5: structured task actions ─────────────────────────────────────────

export type TaskActionName = "create_task" | "update_task_status" | "delete_task";

export interface CreateTaskAction {
  action: "create_task";
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  category: string;
  deadline: string;
}

export interface UpdateStatusAction {
  action: "update_task_status";
  task_id: number;
  status: TaskStatus;
}

export interface DeleteTaskAction {
  action: "delete_task";
  task_id: number;
}

export type TaskAction = CreateTaskAction | UpdateStatusAction | DeleteTaskAction;

/** Result of trying to extract a structured action from a model reply. */
export interface ParsedReply {
  /** The conversational text with any JSON action block stripped out. */
  text: string;
  /** A validated action, or null if the reply is plain conversation. */
  action: TaskAction | null;
  /** Set when a block looked like an action but failed validation. */
  validationError: string | null;
}

const PRIORITIES: readonly Priority[] = ["low", "medium", "high"];
const STATUSES: readonly TaskStatus[] = ["todo", "in_progress", "done"];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** YYYY-MM-DD, must be a real calendar date. */
function isValidDeadline(s: string): boolean {
  if (s === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Extract the first fenced ```json block (or a trailing bare JSON object) from
 * the model reply and return the conversational text with it removed, plus the
 * raw JSON string if found. Defensive: returns rawJson=null when nothing found.
 */
function extractActionBlock(reply: string): { text: string; rawJson: string | null } {
  // Prefer a fenced ```json ... ``` block.
  const fenced = reply.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
  if (fenced) {
    const text = reply.replace(fenced[0], "").trim();
    return { text, rawJson: fenced[1] };
  }
  return { text: reply.trim(), rawJson: null };
}

/**
 * Extract ALL fenced ```json blocks from the reply, returning the raw JSON
 * strings in order plus the conversational text with every block removed.
 */
function extractActionBlocks(reply: string): { text: string; rawJsons: string[] } {
  const re = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
  const rawJsons: string[] = [];
  let text = reply;
  for (const m of reply.matchAll(re)) {
    rawJsons.push(m[1]);
  }
  if (rawJsons.length > 0) {
    text = reply.replace(re, "").trim();
  } else {
    text = reply.trim();
  }
  return { text, rawJsons };
}

/**
 * Validate a parsed JSON value into a concrete TaskAction.
 * Returns a string error message if the shape is an action attempt but invalid.
 * Returns null (no error, no action) only when it is clearly not an action.
 */
function validateAction(
  parsed: unknown
): { action: TaskAction } | { error: string } | null {
  if (!isPlainObject(parsed)) return null;
  const name = parsed.action;
  if (typeof name !== "string") return null;

  if (name === "create_task") {
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    if (title.length === 0) return { error: "create_task requires a non-empty title." };
    if (title.length > 200) return { error: "Task title must be 200 characters or fewer." };

    const description = typeof parsed.description === "string" ? parsed.description : "";
    const category = typeof parsed.category === "string" ? parsed.category : "";
    if (category.trim().length > 50) return { error: "Category must be 50 characters or fewer." };

    const priority = (PRIORITIES as readonly string[]).includes(parsed.priority as string)
      ? (parsed.priority as Priority)
      : "medium";
    const status = (STATUSES as readonly string[]).includes(parsed.status as string)
      ? (parsed.status as TaskStatus)
      : "todo";

    const deadline = typeof parsed.deadline === "string" ? parsed.deadline.trim() : "";
    if (!isValidDeadline(deadline)) return { error: "Deadline must be a valid YYYY-MM-DD date." };

    return {
      action: { action: "create_task", title, description, priority, status, category, deadline },
    };
  }

  if (name === "update_task_status") {
    if (typeof parsed.task_id !== "number" || !Number.isInteger(parsed.task_id)) {
      return { error: "update_task_status requires an integer task_id." };
    }
    if (!(STATUSES as readonly string[]).includes(parsed.status as string)) {
      return { error: "update_task_status requires a valid status (todo, in_progress, done)." };
    }
    return {
      action: { action: "update_task_status", task_id: parsed.task_id, status: parsed.status as TaskStatus },
    };
  }

  if (name === "delete_task") {
    if (typeof parsed.task_id !== "number" || !Number.isInteger(parsed.task_id)) {
      return { error: "delete_task requires an integer task_id." };
    }
    return { action: { action: "delete_task", task_id: parsed.task_id } };
  }

  // Unknown action name — treat as not an action (no mutation).
  return null;
}

/**
 * Parse a model reply into conversational text plus an optional validated
 * action. Any malformed/unexpected JSON yields action=null so a mutation can
 * never be triggered by bad model output.
 */
export function parseReply(reply: string): ParsedReply {
  const { text, rawJson } = extractActionBlock(reply);
  if (rawJson === null) {
    return { text, action: null, validationError: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    // Looked like a block but wasn't valid JSON — never mutate; keep as chat.
    return { text, action: null, validationError: null };
  }

  const result = validateAction(parsed);
  if (result === null) {
    return { text, action: null, validationError: null };
  }
  if ("error" in result) {
    return { text, action: null, validationError: result.error };
  }
  return { text, action: result.action, validationError: null };
}

/** Max create_task actions accepted in a single reply. */
export const MAX_ACTIONS_PER_REPLY = 10;

/** Result of multi-action parsing. */
export interface ParsedReplyMulti {
  /** Conversational text with all JSON blocks removed. */
  text: string;
  /**
   * Validated actions for THIS reply. Either:
   *  - 0 actions (plain chat), or
   *  - exactly 1 non-create action (update_task_status / delete_task), or
   *  - 1..=MAX create_task actions.
   */
  actions: TaskAction[];
  /** Set when a block looked like an action but the batch is invalid. No actions returned then. */
  validationError: string | null;
}

/**
 * Parse a reply that may contain MULTIPLE action blocks. Validates the entire
 * batch before returning — on any invalid block, a mixed batch, a non-create
 * multi-batch, or exceeding the cap, returns `actions: []` plus an error so the
 * caller executes nothing. Reuses `validateAction` unchanged.
 */
export function parseReplyMulti(reply: string): ParsedReplyMulti {
  const { text, rawJsons } = extractActionBlocks(reply);
  if (rawJsons.length === 0) {
    return { text, actions: [], validationError: null };
  }

  const actions: TaskAction[] = [];
  for (let i = 0; i < rawJsons.length; i++) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJsons[i]);
    } catch {
      return { text, actions: [], validationError: `Block #${i + 1} is not valid JSON.` };
    }
    const result = validateAction(parsed);
    if (result === null) {
      // A block that isn't a recognized action invalidates the batch (never
      // silently drop part of a multi-action reply).
      return { text, actions: [], validationError: `Block #${i + 1} is not a supported action.` };
    }
    if ("error" in result) {
      return { text, actions: [], validationError: result.error };
    }
    actions.push(result.action);
  }

  const hasCreate = actions.some((a) => a.action === "create_task");
  const hasNonCreate = actions.some((a) => a.action !== "create_task");

  // Mixed create + status/delete is rejected without executing anything.
  if (hasCreate && hasNonCreate) {
    return {
      text,
      actions: [],
      validationError:
        "Cannot mix task creation with status changes or deletions in one request. Please ask for them separately.",
    };
  }

  // Multiple non-create actions are not allowed (status/delete are single-action).
  if (hasNonCreate && actions.length > 1) {
    return {
      text,
      actions: [],
      validationError:
        "Only one status change or deletion can be requested at a time.",
    };
  }

  // Cap applies to the create batch.
  if (actions.length > MAX_ACTIONS_PER_REPLY) {
    return {
      text,
      actions: [],
      validationError: `Too many tasks in one request (max ${MAX_ACTIONS_PER_REPLY}).`,
    };
  }

  return { text, actions, validationError: null };
}

/**
 * Resolve the target Task for an id-based action against the real task list.
 * Returns the task, or an error message if missing.
 */
export function resolveTaskById(
  tasks: Task[],
  taskId: number
): { task: Task } | { error: string } {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return { error: `No task with id ${taskId} was found. It may have been deleted.` };
  }
  return { task };
}

/**
 * Execute create_task via the existing Module 2 service.
 * Only reports success after the service resolves.
 */
export async function executeCreateTask(action: CreateTaskAction): Promise<Task> {
  const formData: TaskFormData = {
    title: action.title,
    description: action.description,
    priority: action.priority,
    status: action.status,
    category: action.category,
    deadline: action.deadline,
  };
  return createTask(formData);
}

/**
 * Execute an ABSOLUTE, idempotent status change via updateTask.
 * Does NOT use toggleTaskComplete. Rebuilds the full TaskFormData from the
 * existing task, changing only the status, so repeating the request is safe.
 */
export async function executeUpdateStatus(
  existing: Task,
  status: TaskStatus
): Promise<Task> {
  const formData: TaskFormData = {
    title: existing.title,
    description: existing.description ?? "",
    priority: existing.priority,
    status,
    category: existing.category ?? "",
    deadline: existing.deadline ?? "",
  };
  return updateTask(existing.id, formData, existing.created_at);
}

/**
 * Execute delete_task via the existing service.
 * The UI layer is responsible for obtaining explicit user confirmation
 * BEFORE calling this; the function itself performs the deletion.
 */
export async function executeDeleteTask(taskId: number): Promise<void> {
  return deleteTask(taskId);
}

// ── Chat command ──────────────────────────────────────────────────────────────

/**
 * Send the conversation history to the OpenAI API via the Rust backend.
 * Returns the assistant's reply string.
 * Throws a string error message on failure; "no_api_key" indicates missing config.
 */
export async function sendChat(
  messages: ChatMessage[],
  systemPrompt: string
): Promise<string> {
  return invoke<string>("chat", { messages, systemPrompt });
}
