import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { runtimePath } from "./runtime-paths.js";

const SCHEMA_VERSION = "0.3";
const LOCK_WAIT_MS = 25;
const LOCK_TIMEOUT_MS = 5000;
const LOCK_STALE_MS = 30000;

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

const SCOPE_PLACEHOLDER = "待澄清作用范围";
const ACCEPTANCE_PLACEHOLDER = "待澄清完成标准";
const VALID_RISK_LEVELS = new Set(["low", "medium", "high"]);

export function initTaskState(cwd, { taskDraft, taskId, workflowDecision = null }) {
  return withStateWriteLock(cwd, () => {
    const resolvedTaskId = taskId ?? generateTaskId(taskDraft);
    const now = new Date().toISOString();
    const state = {
      schema_version: SCHEMA_VERSION,
      task_id: resolvedTaskId,
      current_phase: "intake",
      current_state: taskDraft?.derived?.state ?? "draft",
      task_draft: taskDraft,
      confirmed_contract: null,
      workflow_decision: workflowDecision,
      evidence: [],
      open_questions: Array.isArray(taskDraft?.open_questions) ? taskDraft.open_questions : [],
      override_history: [],
      created_at: now,
      updated_at: now
    };

    persistTaskState(cwd, resolvedTaskId, state);
    updateIndex(cwd, resolvedTaskId, state, { setActive: true });
    return state;
  });
}

export function confirmTaskContract(cwd, taskId, contractInput = {}) {
  const state = requireTaskState(cwd, taskId);
  const confirmedContract = buildConfirmedContract(state, contractInput);
  const changes = {
    confirmed_contract: confirmedContract,
    open_questions: []
  };

  if (["draft", "needs_clarification"].includes(state.current_state)) {
    changes.current_state = "planned";
  }

  if (["intake", "clarify"].includes(state.current_phase)) {
    changes.current_phase = "plan";
  }

  return updateTaskState(cwd, taskId, changes);
}

export function appendTaskEvidence(cwd, taskId, evidence) {
  if (!taskId) {
    return null;
  }

  const normalizedEvidence = evidence && typeof evidence === "object" ? evidence : null;
  if (!normalizedEvidence) {
    throw new Error("缺少 evidence 对象");
  }

  return updateTaskState(cwd, taskId, {
    evidence: [normalizedEvidence]
  });
}

export function appendTaskOverride(cwd, taskId, entry) {
  if (!taskId) {
    return null;
  }

  const normalizedEntry = entry && typeof entry === "object" ? entry : null;
  if (!normalizedEntry) {
    throw new Error("缺少 override entry 对象");
  }

  return updateTaskState(cwd, taskId, {
    override_history: [normalizedEntry]
  });
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
  return withStateWriteLock(cwd, () => {
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
  });
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

export function setActiveTaskId(cwd, taskId) {
  return withStateWriteLock(cwd, () => {
    const index = loadStateIndex(cwd);
    index.active_task_id = taskId ?? null;
    saveStateIndex(cwd, index);
    return index;
  });
}

function persistTaskState(cwd, taskId, state) {
  ensureDirectory(tasksDirPath(cwd));
  atomicWriteFile(taskFilePath(cwd, taskId), `${JSON.stringify(state, null, 2)}\n`);
}

function updateIndex(cwd, taskId, state, { setActive = false } = {}) {
  const index = loadStateIndex(cwd);
  const entry = {
    task_id: taskId,
    intent: state?.confirmed_contract?.intent ?? state?.task_draft?.intent ?? "unknown",
    goal_summary: state?.confirmed_contract?.goal ?? state?.task_draft?.goal ?? "",
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
  ensureDirectory(stateDirPath(cwd));
  const nextIndex = {
    schema_version: SCHEMA_VERSION,
    active_task_id: index.active_task_id ?? null,
    tasks: Array.isArray(index.tasks) ? index.tasks : []
  };

  atomicWriteFile(stateIndexPath(cwd), `${JSON.stringify(nextIndex, null, 2)}\n`);
}

function taskFilePath(cwd, taskId) {
  return path.join(tasksDirPath(cwd), `${taskId}.json`);
}

function stateIndexPath(cwd) {
  return path.join(stateDirPath(cwd), "index.json");
}

function defaultIndex() {
  return {
    schema_version: SCHEMA_VERSION,
    active_task_id: null,
    tasks: []
  };
}

function buildConfirmedContract(state, contractInput) {
  const draft = normalizeObject(state.task_draft);
  const existing = normalizeObject(state.confirmed_contract);
  const intent = pickString(contractInput.intent, existing.intent, draft.intent);
  const goal = pickString(contractInput.goal, existing.goal, draft.goal);
  const scope = sanitizeScopeLikeArray(pickArray(contractInput.scope, existing.scope, draft.scope), SCOPE_PLACEHOLDER);
  const acceptance = sanitizeScopeLikeArray(
    pickArray(contractInput.acceptance, existing.acceptance, draft.acceptance),
    ACCEPTANCE_PLACEHOLDER
  );

  if (!intent || intent === "unknown") {
    throw new Error("闭合 confirmed_contract 失败：缺少明确 intent");
  }
  if (!goal) {
    throw new Error("闭合 confirmed_contract 失败：缺少明确 goal");
  }
  if (scope.length === 0) {
    throw new Error("闭合 confirmed_contract 失败：缺少明确 scope");
  }
  if (acceptance.length === 0) {
    throw new Error("闭合 confirmed_contract 失败：缺少明确 acceptance");
  }

  const riskLevel = pickRiskLevel(contractInput.riskLevel, existing.risk_level, draft?.derived?.risk_level);
  const contract = {
    intent,
    goal,
    scope,
    acceptance,
    title: pickNullableString(contractInput.title, existing.title, draft.title),
    constraints: pickArray(contractInput.constraints, existing.constraints, draft.constraints),
    verification: pickArray(contractInput.verification, existing.verification),
    context_refs: pickArray(contractInput.contextRefs, existing.context_refs, draft.context_refs),
    id: pickString(contractInput.id, existing.id, state.task_id),
    mode: pickString(contractInput.mode, existing.mode, draft.mode),
    evidence_required: pickArray(contractInput.evidenceRequired, existing.evidence_required)
  };

  if (riskLevel) {
    contract.risk_level = riskLevel;
  }

  return compactObject(contract);
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

function atomicWriteFile(filePath, content) {
  const directory = path.dirname(filePath);
  ensureDirectory(directory);
  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${crypto.randomBytes(3).toString("hex")}.tmp`
  );
  fs.writeFileSync(tempPath, content, "utf8");
  fs.renameSync(tempPath, filePath);
}

function withStateWriteLock(cwd, callback) {
  const lockPath = stateLockDirPath(cwd);
  const release = acquireStateWriteLock(lockPath);
  try {
    return callback();
  } finally {
    release();
  }
}

function acquireStateWriteLock(lockPath) {
  ensureDirectory(path.dirname(lockPath));
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      fs.mkdirSync(lockPath);
      fs.writeFileSync(
        path.join(lockPath, "owner.json"),
        `${JSON.stringify({ pid: process.pid, acquired_at: new Date().toISOString() }, null, 2)}\n`,
        "utf8"
      );
      return () => {
        fs.rmSync(lockPath, { recursive: true, force: true });
      };
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }

      cleanupStaleLock(lockPath);

      if (Date.now() >= deadline) {
        throw new Error(`获取 state 写锁超时: ${lockPath}`);
      }

      sleep(LOCK_WAIT_MS);
    }
  }
}

function cleanupStaleLock(lockPath) {
  try {
    const stats = fs.statSync(lockPath);
    if (Date.now() - stats.mtimeMs > LOCK_STALE_MS) {
      fs.rmSync(lockPath, { recursive: true, force: true });
    }
  } catch {
    // lock 已被其他进程释放，无需处理
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function toArray(value) {
  return Array.isArray(value) ? value : [value];
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function pickNullableString(...values) {
  for (const value of values) {
    if (value === null) {
      return null;
    }
    if (typeof value === "string") {
      return value.trim();
    }
  }
  return null;
}

function pickArray(...values) {
  for (const value of values) {
    const normalized = normalizeArray(value);
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return [];
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (value == null) {
    return [];
  }
  const normalized = String(value).trim();
  return normalized ? [normalized] : [];
}

function sanitizeScopeLikeArray(values, placeholder) {
  return normalizeArray(values).filter((item) => item !== placeholder);
}

function pickRiskLevel(...values) {
  for (const value of values) {
    if (typeof value === "string" && VALID_RISK_LEVELS.has(value.trim())) {
      return value.trim();
    }
  }
  return null;
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null)
  );
}

function stateDirPath(cwd) {
  return runtimePath(cwd, "state");
}

function tasksDirPath(cwd) {
  return runtimePath(cwd, "state", "tasks");
}

function stateLockDirPath(cwd) {
  return runtimePath(cwd, "state", ".write-lock");
}
