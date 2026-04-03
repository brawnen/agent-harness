import path from "node:path";

import { appendAuditEntry } from "../lib/audit-store.js";
import { loadProjectConfig } from "../lib/project-config.js";
import { getTaskState, resolveActiveTaskId } from "../lib/state-store.js";

const EXIT_ALLOW = 0;
const EXIT_BLOCK = 1;
const EXIT_REQUIRE_CONFIRM = 2;

const WRITE_TOOLS = new Set(["Write", "Edit", "Bash", "NotebookEdit"]);

export function runGate(argv) {
  const [subcommand, ...rest] = argv;

  if (subcommand !== "before-tool") {
    console.error("gate 目前只支持 before-tool");
    return 1;
  }

  const parsed = parseBeforeToolArgs(rest);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  const result = beforeTool(process.cwd(), parsed.options);
  console.log(`${JSON.stringify(result, null, 2)}\n`);
  return result.exit_code;
}

function parseBeforeToolArgs(argv) {
  const options = {
    filePath: null,
    taskId: null,
    tool: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--tool") {
      options.tool = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--task-id") {
      options.taskId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--file-path") {
      options.filePath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  if (!options.tool) {
    return { ok: false, error: "需要 --tool 参数" };
  }

  return { ok: true, options };
}

function beforeTool(cwd, options) {
  const taskId = options.taskId ?? resolveActiveTaskId(cwd);
  const taskState = taskId ? getTaskState(cwd, taskId) : null;
  const config = loadProjectConfig(cwd);

  if (!taskState) {
    if (taskId) {
      appendAuditEntry(cwd, {
        description: "State 文件不存在，降级允许执行",
        event_type: "gate_violation",
        phase: "execute",
        risk_at_time: "unknown",
        signal: "proceed_to_execute",
        task_id: taskId
      });
    }
    return allow("State 文件不存在，降级允许");
  }

  const currentState = taskState.current_state;
  const currentPhase = taskState.current_phase;
  const filePath = normalizeFilePath(cwd, options.filePath);
  const riskLevel = deriveRiskLevel(taskState);

  if (currentState === "needs_clarification" && isWriteTool(options.tool)) {
    return block(cwd, taskState.task_id, currentPhase, riskLevel, "任务处于 needs_clarification 状态，禁止执行写入操作");
  }

  if (currentState === "draft" && isWriteTool(options.tool)) {
    return block(cwd, taskState.task_id, currentPhase, riskLevel, "任务合同未闭合（draft 状态），禁止执行写入操作");
  }

  if (["blocked", "failed", "done", "suspended"].includes(currentState) && isWriteTool(options.tool)) {
    return block(cwd, taskState.task_id, currentPhase, riskLevel, `任务处于 ${currentState} 状态，禁止执行写入操作`);
  }

  if (riskLevel === "high" && isWriteTool(options.tool) && !hasRiskConfirmation(taskState)) {
    return requireConfirmation(cwd, taskState.task_id, currentPhase, "high", "任务命中高风险范围，需要用户确认后继续");
  }

  if (filePath && config && isWriteTool(options.tool) && config.protected_paths.some((pattern) => pathMatch(filePath, pattern))) {
    return block(cwd, taskState.task_id, currentPhase, riskLevel, `目标路径 ${filePath} 命中 protected_paths，禁止写入`);
  }

  if (filePath && isWriteTool(options.tool)) {
    const scope = taskState?.confirmed_contract?.scope ?? taskState?.task_draft?.scope ?? [];
    const pathScopes = scope.filter((item) => item.includes("/") || item.includes("*"));
    if (pathScopes.length > 0 && !pathScopes.some((pattern) => pathMatch(filePath, pattern))) {
      return block(cwd, taskState.task_id, currentPhase, riskLevel, `目标路径 ${filePath} 超出任务 scope: ${pathScopes.join(", ")}`);
    }
  }

  return allow("门禁通过");
}

function deriveRiskLevel(taskState) {
  return taskState?.confirmed_contract?.risk_level ?? taskState?.task_draft?.derived?.risk_level ?? "medium";
}

function hasRiskConfirmation(taskState) {
  return Array.isArray(taskState?.override_history) &&
    taskState.override_history.some((item) => item.event_type === "manual_confirmation");
}

function isWriteTool(toolName) {
  return WRITE_TOOLS.has(toolName);
}

function normalizeFilePath(cwd, filePath) {
  if (!filePath) {
    return null;
  }

  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  return path.relative(cwd, absolute).replace(/\\/g, "/");
}

function pathMatch(filePath, pattern) {
  const relative = filePath.replace(/^\.\//, "");
  const normalizedPattern = pattern.replace(/^\.\//, "");
  const regex = globToRegExp(normalizedPattern);
  return regex.test(relative) || relative.startsWith(normalizedPattern.replace(/\*+$/, "").replace(/\/$/, ""));
}

function globToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DOUBLE_STAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLE_STAR::/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function allow(reason) {
  return { exit_code: EXIT_ALLOW, reason, signal: "proceed_to_execute" };
}

function block(cwd, taskId, phase, risk, reason) {
  appendAuditEntry(cwd, {
    description: reason,
    event_type: "gate_violation",
    phase,
    risk_at_time: risk,
    signal: "block_execution",
    task_id: taskId
  });
  return { exit_code: EXIT_BLOCK, phase, reason, risk, signal: "block_execution" };
}

function requireConfirmation(cwd, taskId, phase, risk, reason) {
  appendAuditEntry(cwd, {
    description: reason,
    event_type: "gate_violation",
    phase,
    risk_at_time: risk,
    signal: "require_confirmation",
    task_id: taskId
  });
  return { exit_code: EXIT_REQUIRE_CONFIRM, phase, reason, risk, signal: "require_confirmation" };
}
