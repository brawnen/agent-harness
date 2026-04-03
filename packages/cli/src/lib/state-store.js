import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SCHEMA_VERSION = "0.2";
const STATE_DIR = path.join("harness", "state");
const TASKS_DIR = path.join(STATE_DIR, "tasks");

const VALID_PHASES = ["intake", "clarify", "plan", "execute", "verify", "report", "close"];
const VALID_STATES = [
  "draft",
  "needs_clarification",
  "planned",
  "in_progress",
  "blocked",
  "verifying",
  "done",
  "failed",
  "suspended"
];

const VALID_TRANSITIONS = {
  draft: ["needs_clarification", "planned", "failed", "suspended"],
  needs_clarification: ["draft", "planned", "failed", "suspended"],
  planned: ["in_progress", "needs_clarification", "suspended"],
  in_progress: ["blocked", "verifying", "failed", "suspended"],
  blocked: ["in_progress", "needs_clarification", "failed", "suspended"],
  verifying: ["done", "failed", "in_progress", "suspended"],
  done: [],
  failed: ["draft"],
  suspended: ["draft", "needs_clarification", "planned", "in_progress", "blocked", "verifying"]
};

export function initTaskState(cwd, { taskDraft, taskId }) {
  const resolvedTaskId = taskId ?? generateTaskId(taskDraft);
  const now = new Date().toISOString();
  const state = {
    schema_version: SCHEMA_VERSION,
    task_id: resolvedTaskId,
    current_phase: "intake",
    current_state: taskDraft?.derived?.state ?? "draft",
    task_draft: taskDraft,
    confirmed_contract: null,
    evidence: [],
    open_questions: Array.isArray(taskDraft?.open_questions) ? taskDraft.open_questions : [],
    override_history: [],
    created_at: now,
    updated_at: now
  };

  persistTaskState(cwd, resolvedTaskId, state);
  updateIndex(cwd, resolvedTaskId, state, { setActive: true });
  return state;
}

export function getTaskState(cwd, taskId) {
  const statePath = taskFilePath(cwd, taskId);
  if (!fs.existsSync(statePath)) {
    return null;
  }

  return readJson(statePath);
}

export function requireTaskState(cwd, taskId) {
  const taskState = getTaskState(cwd, taskId);
  if (!taskState) {
    throw new Error(`任务不存在: ${taskId}`);
  }
  return taskState;
}

export function updateTaskState(cwd, taskId, changes) {
  const state = requireTaskState(cwd, taskId);

  if (Object.hasOwn(changes, "current_phase")) {
    validatePhase(changes.current_phase);
  }

  if (Object.hasOwn(changes, "current_state")) {
    validateState(changes.current_state);
    validateTransition(state.current_state, changes.current_state);
  }

  for (const [key, value] of Object.entries(changes)) {
    if (key === "evidence") {
      state.evidence = [...(state.evidence ?? []), ...toArray(value)];
      continue;
    }

    if (key === "override_history") {
      state.override_history = [...(state.override_history ?? []), ...toArray(value)];
      continue;
    }

    if (key === "open_questions") {
      state.open_questions = toArray(value);
      continue;
    }

    state[key] = value;
  }

  state.updated_at = new Date().toISOString();
  persistTaskState(cwd, taskId, state);
  updateIndex(cwd, taskId, state);
  return state;
}

export function loadStateIndex(cwd) {
  const indexPath = stateIndexPath(cwd);
  if (!fs.existsSync(indexPath)) {
    return defaultIndex();
  }

  return readJson(indexPath);
}

export function getActiveTask(cwd) {
  const activeTaskId = resolveActiveTaskId(cwd);
  if (!activeTaskId) {
    return null;
  }
  return getTaskState(cwd, activeTaskId);
}

export function resolveActiveTaskId(cwd) {
  const index = loadStateIndex(cwd);
  return index.active_task_id ?? null;
}

export function resolveTaskId(cwd, explicitTaskId) {
  if (explicitTaskId) {
    return explicitTaskId;
  }

  const activeTaskId = resolveActiveTaskId(cwd);
  if (!activeTaskId) {
    throw new Error("未指定 --task-id，且当前项目没有 active task");
  }

  return activeTaskId;
}

function persistTaskState(cwd, taskId, state) {
  ensureDirectory(path.join(cwd, TASKS_DIR));
  fs.writeFileSync(taskFilePath(cwd, taskId), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function updateIndex(cwd, taskId, state, { setActive = false } = {}) {
  const index = loadStateIndex(cwd);
  const entry = {
    task_id: taskId,
    intent: state?.task_draft?.intent ?? state?.confirmed_contract?.intent ?? "unknown",
    goal_summary: state?.task_draft?.goal ?? state?.confirmed_contract?.goal ?? "",
    current_state: state.current_state,
    updated_at: state.updated_at
  };

  const existingIndex = index.tasks.findIndex((item) => item.task_id === taskId);
  if (existingIndex >= 0) {
    index.tasks[existingIndex] = entry;
  } else {
    index.tasks.push(entry);
  }

  if (setActive) {
    index.active_task_id = taskId;
  }

  saveStateIndex(cwd, index);
}

function saveStateIndex(cwd, index) {
  ensureDirectory(path.join(cwd, STATE_DIR));
  const nextIndex = {
    schema_version: SCHEMA_VERSION,
    active_task_id: index.active_task_id ?? null,
    tasks: Array.isArray(index.tasks) ? index.tasks : []
  };

  fs.writeFileSync(stateIndexPath(cwd), `${JSON.stringify(nextIndex, null, 2)}\n`, "utf8");
}

function taskFilePath(cwd, taskId) {
  return path.join(cwd, TASKS_DIR, `${taskId}.json`);
}

function stateIndexPath(cwd) {
  return path.join(cwd, STATE_DIR, "index.json");
}

function defaultIndex() {
  return {
    schema_version: SCHEMA_VERSION,
    active_task_id: null,
    tasks: []
  };
}

function validatePhase(phase) {
  if (!VALID_PHASES.includes(phase)) {
    throw new Error(`无效的 phase: ${phase}`);
  }
}

function validateState(state) {
  if (!VALID_STATES.includes(state)) {
    throw new Error(`无效的 state: ${state}`);
  }
}

function validateTransition(from, to) {
  if (from === to) {
    return;
  }

  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`非法状态迁移: ${from} -> ${to}。${from} 允许迁移到: ${allowed.join(", ")}`);
  }
}

function generateTaskId(taskDraft) {
  const intent = taskDraft?.intent ?? "task";
  const goal = String(taskDraft?.goal ?? "")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join("-");
  const slug = (goal || "unnamed").toLowerCase().replace(/[^a-z0-9-]/g, "") || "unnamed";
  return `${intent}-${slug}-${crypto.randomBytes(3).toString("hex")}`;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(`JSON 解析失败: ${filePath}`);
  }
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function toArray(value) {
  return Array.isArray(value) ? value : [value];
}
