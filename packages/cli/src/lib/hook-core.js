import path from "node:path";

import { appendAuditEntry, readAuditEntries } from "./audit-store.js";
import { beforeTool } from "../commands/gate.js";
import { normalizeOutputPolicy } from "./output-policy.js";
import { loadProjectConfig } from "./project-config.js";
import {
  autoIntakePrompt,
  buildCurrentTaskContext,
  classifyUserOverridePrompt
} from "./task-core.js";
import {
  appendTaskEvidence,
  appendTaskOverride,
  getActiveTask,
  resolveActiveTaskId,
  setActiveTaskId
} from "./state-store.js";
import { verifyTaskState } from "../commands/verify.js";

const COMPLETION_KEYWORDS = [
  "已完成",
  "完成了",
  "任务完成",
  "已经收口",
  "收口完成",
  "验证通过",
  "本地提交已完成",
  "done",
  "completed"
];

const NON_FINAL_COMPLETION_KEYWORDS = [
  "未完成",
  "尚未完成",
  "还未完成",
  "部分完成",
  "第一步完成",
  "初步完成"
];

const TEST_COMMAND_PATTERNS = [
  /\bnpm test\b/i,
  /\bpnpm test\b/i,
  /\byarn test\b/i,
  /\bjest\b/i,
  /\bvitest\b/i,
  /\bpytest\b/i,
  /\bgo test\b/i,
  /\bcargo test\b/i,
  /\bmvn test\b/i,
  /\bgradlew test\b/i,
  /\bunittest\b/i
];

const SUPPORTED_GATE_TOOLS = new Set(["Write", "Edit", "NotebookEdit", "Bash"]);

export function continueDecision(additionalContext = "") {
  return {
    additionalContext: typeof additionalContext === "string" ? additionalContext.trim() : "",
    status: "continue"
  };
}

export function blockDecision(reason) {
  return {
    reason,
    status: "block"
  };
}

export function buildManualFallbackContext(reason, { commands = [], hostDisplayName = "Hook" } = {}) {
  const message = typeof reason === "string" && reason.trim().length > 0
    ? reason.trim()
    : `${hostDisplayName} hook 执行失败`;
  const fallbackCommands = Array.isArray(commands) ? commands.filter(Boolean) : [];

  if (fallbackCommands.length === 0) {
    return `${message} 已降级继续。`;
  }

  return `${message} 已降级到手动模式。可用 fallback：${fallbackCommands.join("；")}`;
}

export function handleSessionStart({
  cwd,
  fallbackCommands = [],
  hostDisplayName = "Hook",
  source = ""
}) {
  try {
    const activeTask = getActiveTask(cwd);
    if (!activeTask) {
      return continueDecision();
    }

    const sourceText = source ? `来源：${source}。` : "";
    return continueDecision(`${sourceText}${buildCurrentTaskContext(activeTask)}`);
  } catch (error) {
    return continueDecision(buildManualFallbackContext(
      `${hostDisplayName} 自动恢复 active task 失败：${error.message}`,
      { commands: fallbackCommands, hostDisplayName }
    ));
  }
}

export function handlePromptSubmit({
  cwd,
  fallbackCommands = [],
  hostDisplayName = "Hook",
  prompt = ""
}) {
  try {
    if (!prompt.trim()) {
      return continueDecision();
    }

    const overrideHandled = handleUserOverridePrompt({ cwd, hostDisplayName, prompt });
    if (overrideHandled) {
      return continueDecision(overrideHandled.additionalContext);
    }

    const result = autoIntakePrompt(cwd, prompt);
    if (result.block) {
      return blockDecision("当前请求需要先确认后再继续。");
    }

    return continueDecision(result.additionalContext);
  } catch (error) {
    return continueDecision(buildManualFallbackContext(
      `${hostDisplayName} 自动 intake 失败：${error.message}`,
      { commands: fallbackCommands, hostDisplayName }
    ));
  }
}

export function handleCompletionGate({ cwd, lastAssistantMessage = "" }) {
  try {
    const activeTask = getActiveTask(cwd);
    if (!shouldBlockCompletionGate(lastAssistantMessage, activeTask)) {
      return continueDecision();
    }

    const projectConfig = loadProjectConfig(cwd);
    const reportPolicy = normalizeOutputPolicy(projectConfig?.output_policy).report;
    const verification = verifyTaskState(activeTask, { reportPolicy });

    if (!verification.allowed) {
      return blockDecision(`当前任务 ${activeTask.task_id} 尚未满足完成门禁：${verification.missing_evidence[0]}。请先补齐验证或证据，再结束本轮。`);
    }

    if (activeTask.current_state !== "done") {
      return blockDecision(`当前任务 ${activeTask.task_id} 验证已通过，但尚未完成 report 收口。请先执行 report 并更新任务状态，再结束本轮。`);
    }

    return continueDecision();
  } catch {
    return continueDecision();
  }
}

export function handleBeforeTool({
  command = "",
  cwd,
  filePath = null,
  taskId = null,
  toolName = null
}) {
  try {
    const normalizedToolName = normalizeHarnessToolName(toolName);
    if (!normalizedToolName || !SUPPORTED_GATE_TOOLS.has(normalizedToolName)) {
      return continueDecision();
    }

    if (taskId) {
      setActiveTaskId(cwd, taskId);
    }

    if (normalizedToolName === "Bash" && isReadOnlyBashCommand(command)) {
      return continueDecision();
    }

    const resolvedFilePath = resolveGateFilePath({
      command,
      cwd,
      filePath,
      toolName: normalizedToolName
    });

    const result = beforeTool(cwd, {
      filePath: resolvedFilePath ?? null,
      taskId: taskId ?? null,
      tool: normalizedToolName
    });

    if (result.signal === "block_execution" || result.signal === "require_confirmation") {
      return blockDecision("当前操作暂不可执行，请先完成必要确认后再继续。");
    }

    return continueDecision();
  } catch {
    return continueDecision();
  }
}

export function handleAfterTool({
  command = "",
  cwd,
  exitCode = null,
  output = "",
  toolName = null
}) {
  try {
    const normalizedToolName = normalizeHarnessToolName(toolName);
    if (normalizedToolName !== "Bash") {
      return continueDecision();
    }

    const activeTaskId = resolveActiveTaskId(cwd);
    if (!activeTaskId) {
      return continueDecision();
    }

    const activeTask = getActiveTask(cwd);
    if (!activeTask || ["done", "failed", "suspended"].includes(activeTask.current_state)) {
      return continueDecision();
    }

    appendTaskEvidence(cwd, activeTaskId, {
      content: buildEvidenceContent(command, exitCode, output),
      exit_code: exitCode,
      passed: typeof exitCode === "number" ? exitCode === 0 : undefined,
      timestamp: new Date().toISOString(),
      type: inferEvidenceType(command, activeTask)
    });

    return continueDecision();
  } catch {
    return continueDecision();
  }
}

export function normalizeHarnessToolName(toolName) {
  const normalized = String(toolName ?? "").trim();
  if (!normalized) {
    return null;
  }

  const mapping = {
    Bash: "Bash",
    Edit: "Edit",
    NotebookEdit: "NotebookEdit",
    Write: "Write",
    replace: "Edit",
    run_shell_command: "Bash",
    write_file: "Write"
  };

  return mapping[normalized] ?? null;
}

function handleUserOverridePrompt({ cwd, hostDisplayName, prompt }) {
  const activeTask = getActiveTask(cwd);
  if (!activeTask || ["done", "failed", "suspended"].includes(activeTask.current_state)) {
    return null;
  }

  const overrideDecision = classifyUserOverridePrompt(prompt);
  if (!overrideDecision) {
    return null;
  }

  const phase = activeTask.current_phase ?? "execute";
  const riskLevel = deriveRiskLevel(activeTask);
  const pendingConfirmation = hasPendingRiskConfirmation(cwd, activeTask.task_id);
  const additionalNotes = [];

  if (overrideDecision.type === "manual_confirmation") {
    if (!(riskLevel === "high" && pendingConfirmation)) {
      return null;
    }

    const entry = appendOverrideEntry(cwd, activeTask.task_id, {
      description: `用户在 ${hostDisplayName} PromptSubmit 中确认继续执行当前高风险任务。`,
      event_type: "manual_confirmation",
      phase,
      risk_at_time: riskLevel,
      signal: "user_confirmed_high_risk_action",
      user_input: prompt
    });

    additionalNotes.push(`已记录 manual_confirmation：${entry.description}`);
    return {
      additionalContext: additionalNotes.join(" ")
    };
  }

  const forceOverrideEntry = appendOverrideEntry(cwd, activeTask.task_id, {
    description: `用户在 ${hostDisplayName} PromptSubmit 中显式要求跳过当前门禁并继续执行。`,
    event_type: "force_override",
    phase,
    risk_at_time: riskLevel,
    signal: "user_requested_force_override",
    user_input: prompt
  });
  additionalNotes.push(`已记录 force_override：${forceOverrideEntry.description}`);

  if (riskLevel === "high" && pendingConfirmation) {
    const confirmationEntry = appendOverrideEntry(cwd, activeTask.task_id, {
      description: "force override 同时视为用户确认继续执行当前高风险任务。",
      event_type: "manual_confirmation",
      phase,
      risk_at_time: riskLevel,
      signal: "user_confirmed_high_risk_action",
      user_input: prompt
    });
    additionalNotes.push(`已同步记录 manual_confirmation：${confirmationEntry.description}`);
  }

  return {
    additionalContext: additionalNotes.join(" ")
  };
}

function appendOverrideEntry(cwd, taskId, entry) {
  const persistedEntry = appendAuditEntry(cwd, {
    ...entry,
    task_id: taskId
  });
  appendTaskOverride(cwd, taskId, persistedEntry);
  return persistedEntry;
}

function deriveRiskLevel(taskState) {
  return taskState?.confirmed_contract?.risk_level ?? taskState?.task_draft?.derived?.risk_level ?? "medium";
}

function hasPendingRiskConfirmation(cwd, taskId) {
  const entries = readAuditEntries(cwd, taskId);
  let latestRequireConfirmationAt = null;
  let latestManualConfirmationAt = null;

  for (const entry of entries) {
    if (entry?.event_type === "gate_violation" && entry?.signal === "require_confirmation") {
      latestRequireConfirmationAt = pickLaterTimestamp(latestRequireConfirmationAt, entry.timestamp);
      continue;
    }

    if (entry?.event_type === "manual_confirmation") {
      latestManualConfirmationAt = pickLaterTimestamp(latestManualConfirmationAt, entry.timestamp);
    }
  }

  if (!latestRequireConfirmationAt) {
    return false;
  }

  if (!latestManualConfirmationAt) {
    return true;
  }

  return latestRequireConfirmationAt > latestManualConfirmationAt;
}

function pickLaterTimestamp(currentValue, nextValue) {
  if (!nextValue) {
    return currentValue;
  }
  if (!currentValue) {
    return nextValue;
  }
  return nextValue > currentValue ? nextValue : currentValue;
}

function shouldBlockCompletionGate(lastAssistantMessage, activeTask) {
  if (!activeTask) {
    return false;
  }

  if (["done", "failed", "suspended"].includes(activeTask.current_state)) {
    return false;
  }

  const message = String(lastAssistantMessage ?? "").trim().toLowerCase();
  if (!message) {
    return false;
  }

  if (NON_FINAL_COMPLETION_KEYWORDS.some((keyword) => message.includes(keyword))) {
    return false;
  }

  if (!COMPLETION_KEYWORDS.some((keyword) => message.includes(keyword))) {
    return false;
  }

  return true;
}

function resolveGateFilePath({ command, cwd, filePath, toolName }) {
  if (filePath) {
    return normalizeCandidatePath(filePath, cwd);
  }

  if (toolName !== "Bash" || !command) {
    return null;
  }

  const inferredPath = inferBashTargetPath(command);
  if (!inferredPath) {
    return null;
  }

  return normalizeCandidatePath(inferredPath, cwd);
}

function normalizeCandidatePath(candidate, cwd) {
  if (path.isAbsolute(candidate)) {
    return path.relative(cwd, candidate).replace(/\\/g, "/");
  }
  return candidate;
}

function inferEvidenceType(command, activeTask) {
  const normalizedCommand = String(command ?? "");
  if (activeTask?.current_phase === "verify" || TEST_COMMAND_PATTERNS.some((pattern) => pattern.test(normalizedCommand))) {
    return "test_result";
  }
  return "command_result";
}

function buildEvidenceContent(command, exitCode, output) {
  const lines = [`Command: ${command || "<unknown command>"}`];
  if (typeof exitCode === "number") {
    lines.push(`Exit code: ${exitCode}`);
  }

  const normalizedOutput = String(output ?? "").trim();
  if (normalizedOutput) {
    const compact = normalizedOutput.length > 400
      ? `${normalizedOutput.slice(0, 400)}...`
      : normalizedOutput;
    lines.push(`Output: ${compact}`);
  }

  return lines.join("\n");
}

function inferBashTargetPath(command) {
  const unwrapped = unwrapShellCommand(command);

  const redirectMatch = unwrapped.match(/(?:^|\s)(?:\d?>|>>|>\|)\s*(['"]?)([^'" \t;|&]+)\1/);
  if (redirectMatch) {
    return redirectMatch[2];
  }

  const teeMatch = unwrapped.match(/\btee\s+(?:-a\s+)?(['"]?)([^'" \t;|&]+)\1/);
  if (teeMatch) {
    return teeMatch[2];
  }

  const mkdirMatch = unwrapped.match(/\bmkdir\s+(?:-p\s+)?(['"]?)([^'" \t;|&]+)\1/);
  if (mkdirMatch) {
    return mkdirMatch[2];
  }

  const installTarget = inferInstallTarget(unwrapped);
  if (installTarget) {
    return installTarget;
  }

  const touchMatch = unwrapped.match(/\btouch\s+(['"]?)([^'" \t;|&]+)\1/);
  if (touchMatch) {
    return touchMatch[2];
  }

  const sedTarget = inferInPlaceEditorTarget(unwrapped, "sed");
  if (sedTarget) {
    return sedTarget;
  }

  const perlTarget = inferInPlaceEditorTarget(unwrapped, "perl");
  if (perlTarget) {
    return perlTarget;
  }

  const rmMatch = unwrapped.match(/\brm\s+(?:-rf?\s+)?(['"]?)([^'" \t;|&]+)\1/);
  if (rmMatch) {
    return rmMatch[2];
  }

  const metadataTarget = inferMetadataTarget(unwrapped);
  if (metadataTarget) {
    return metadataTarget;
  }

  const truncateTarget = inferTruncateTarget(unwrapped);
  if (truncateTarget) {
    return truncateTarget;
  }

  const ddTarget = inferDdTarget(unwrapped);
  if (ddTarget) {
    return ddTarget;
  }

  const copyMoveMatch = unwrapped.match(/\b(?:mv|cp)\s+(['"]?)([^'" \t;|&]+)\1\s+(['"]?)([^'" \t;|&]+)\3/);
  if (copyMoveMatch) {
    return copyMoveMatch[4];
  }

  const rsyncTarget = inferRsyncTarget(unwrapped);
  if (rsyncTarget) {
    return rsyncTarget;
  }

  const linkMatch = unwrapped.match(/\bln\b(?:\s+-[^\s]+\b)*\s+(['"]?)([^'" \t;|&]+)\1\s+(['"]?)([^'" \t;|&]+)\3/);
  if (linkMatch) {
    return linkMatch[4];
  }

  return null;
}

function isReadOnlyBashCommand(command) {
  const normalized = unwrapShellCommand(command);
  if (!normalized) {
    return false;
  }

  if (/[>]{1,2}|>\||\btee\b|\bmkdir\b|\btouch\b|\brm\b|\bmv\b|\bcp\b|\bln\b|\bsed\s+-i\b|\bperl\s+-i\b|\binstall\b|\btruncate\b|\bdd\b/.test(normalized)) {
    return false;
  }

  const firstToken = normalized.trim().split(/\s+/)[0] ?? "";
  const readOnlyCommands = new Set([
    "ls",
    "pwd",
    "cat",
    "head",
    "tail",
    "sed",
    "awk",
    "grep",
    "rg",
    "find",
    "which",
    "git",
    "env",
    "printenv",
    "echo",
    "printf",
    "wc",
    "sort",
    "uniq",
    "cut",
    "tr",
    "basename",
    "dirname",
    "realpath",
    "readlink",
    "stat",
    "file",
    "du",
    "df",
    "ps",
    "date"
  ]);

  if (firstToken === "git") {
    return /\bgit\s+(?:status|diff|show|log|branch|rev-parse|remote|config|ls-files)\b/.test(normalized);
  }

  return readOnlyCommands.has(firstToken);
}

function unwrapShellCommand(command) {
  const trimmed = String(command ?? "").trim();
  const quotedMatch = trimmed.match(/^(?:bash|sh|zsh)\s+-lc\s+(['"])([\s\S]*)\1$/);
  if (quotedMatch) {
    return quotedMatch[2].trim();
  }
  return trimmed;
}

function inferInstallTarget(command) {
  const match = command.match(/\binstall\b(?:\s+-[^\s]+\b)*\s+(['"]?)([^'" \t;|&]+)\1\s+(['"]?)([^'" \t;|&]+)\3/);
  return match ? match[4] : null;
}

function inferInPlaceEditorTarget(command, editorName) {
  const escapedEditor = editorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escapedEditor}\\b(?:\\s+-[^\\s]+\\b|\\s+['"][^'"]*['"]|\\s+[^\\s'"]+)*\\s+(['"]?)([^'" \\t;|&]+)\\1$`);
  const match = command.match(regex);
  return match ? match[2] : null;
}

function inferMetadataTarget(command) {
  const match = command.match(/\b(?:chmod|chown|chgrp)\b(?:\s+-[^\s]+\b)*\s+[^'" \t;|&]+\s+(['"]?)([^'" \t;|&]+)\1/);
  return match ? match[2] : null;
}

function inferTruncateTarget(command) {
  const match = command.match(/\btruncate\b(?:\s+-[^\s]+\b\s+)*(['"]?)([^'" \t;|&]+)\1/);
  return match ? match[2] : null;
}

function inferDdTarget(command) {
  const match = command.match(/\bof=([^'" \t;|&]+)/);
  return match ? match[1] : null;
}

function inferRsyncTarget(command) {
  const match = command.match(/\brsync\b(?:\s+-[^\s]+\b)*\s+(['"]?)([^'" \t;|&]+)\1\s+(['"]?)([^'" \t;|&]+)\3/);
  return match ? match[4] : null;
}
