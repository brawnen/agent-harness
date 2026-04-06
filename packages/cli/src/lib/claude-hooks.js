import fs from "node:fs";

import { appendAuditEntry, readAuditEntries } from "./audit-store.js";
import { normalizeOutputPolicy } from "./output-policy.js";
import { loadProjectConfig } from "./project-config.js";
import {
  autoIntakePrompt,
  buildCurrentTaskContext,
  classifyUserOverridePrompt
} from "./task-core.js";
import { appendTaskOverride, getActiveTask } from "./state-store.js";
import { verifyTaskState } from "../commands/verify.js";

const MANUAL_FALLBACK_COMMANDS = [
  "npx @brawnen/agent-harness-cli state active",
  "npx @brawnen/agent-harness-cli task intake \"任务描述\"",
  "npx @brawnen/agent-harness-cli task suspend-active --reason \"切换任务\""
];

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

export function readHookPayload() {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Claude hook stdin 不是合法 JSON");
  }
}

export function handleClaudeSessionStart(payload) {
  try {
    const cwd = resolvePayloadCwd(payload);
    const activeTask = getActiveTask(cwd);

    if (!activeTask) {
      return {};
    }

    const source = payload?.source ? `来源：${payload.source}。` : "";
    return buildAdditionalContextOutput("SessionStart", `${source}${buildCurrentTaskContext(activeTask)}`);
  } catch (error) {
    return buildAdditionalContextOutput("SessionStart", buildManualFallbackContext(`Claude 自动恢复 active task 失败：${error.message}`));
  }
}

export function handleClaudeUserPromptSubmit(payload) {
  try {
    const cwd = resolvePayloadCwd(payload);
    const prompt = resolvePayloadPrompt(payload);

    if (!prompt.trim()) {
      return {};
    }

    const overrideHandled = handleUserOverridePrompt(cwd, prompt);
    if (overrideHandled) {
      return buildAdditionalContextOutput("UserPromptSubmit", overrideHandled.additionalContext);
    }

    const result = autoIntakePrompt(cwd, prompt);
    if (result.block) {
      return buildBlockOutput("当前请求需要先确认后再继续。");
    }

    if (!result.additionalContext) {
      return {};
    }

    return buildAdditionalContextOutput("UserPromptSubmit", result.additionalContext);
  } catch (error) {
    return buildAdditionalContextOutput("UserPromptSubmit", buildManualFallbackContext(`Claude 自动 intake 失败：${error.message}`));
  }
}

export function handleClaudeStop(payload) {
  try {
    const cwd = resolvePayloadCwd(payload);
    const activeTask = getActiveTask(cwd);

    if (!shouldBlockStop(payload, activeTask)) {
      return {};
    }

    const projectConfig = loadProjectConfig(cwd);
    const reportPolicy = normalizeOutputPolicy(projectConfig?.output_policy).report;
    const verification = verifyTaskState(activeTask, { reportPolicy });

    if (!verification.allowed) {
      return buildBlockOutput(`当前任务 ${activeTask.task_id} 尚未满足完成门禁：${verification.missing_evidence[0]}。请先补齐验证或证据，再结束本轮。`);
    }

    if (activeTask.current_state !== "done") {
      return buildBlockOutput(`当前任务 ${activeTask.task_id} 验证已通过，但尚未完成 report 收口。请先执行 report 并更新任务状态，再结束本轮。`);
    }

    return {};
  } catch {
    return {};
  }
}

function buildAdditionalContextOutput(hookEventName, additionalContext) {
  if (!additionalContext || !additionalContext.trim()) {
    return {};
  }

  return {
    hookSpecificOutput: {
      hookEventName,
      additionalContext: additionalContext.trim()
    }
  };
}

function buildBlockOutput(reason) {
  return {
    decision: "block",
    reason
  };
}

function buildManualFallbackContext(reason) {
  const message = typeof reason === "string" && reason.trim().length > 0
    ? reason.trim()
    : "Claude hook 执行失败";
  return `${message} 已降级到手动模式。可用 fallback：${MANUAL_FALLBACK_COMMANDS.join("；")}`;
}

function resolvePayloadPrompt(payload) {
  if (typeof payload?.prompt === "string") {
    return payload.prompt;
  }
  if (typeof payload?.input === "string") {
    return payload.input;
  }
  return "";
}

function resolvePayloadCwd(payload) {
  return payload?.cwd || process.cwd();
}

function handleUserOverridePrompt(cwd, prompt) {
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
      description: "用户在 Claude Code UserPromptSubmit 中确认继续执行当前高风险任务。",
      event_type: "manual_confirmation",
      phase,
      risk_at_time: riskLevel,
      signal: "user_confirmed_high_risk_action",
      user_input: prompt
    });

    additionalNotes.push(`已记录 manual_confirmation：${entry.description}`);
    return {
      additionalContext: `${buildCurrentTaskContext(getActiveTask(cwd))} ${additionalNotes.join(" ")}`
    };
  }

  const forceOverrideEntry = appendOverrideEntry(cwd, activeTask.task_id, {
    description: "用户在 Claude Code UserPromptSubmit 中显式要求跳过当前门禁并继续执行。",
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
    additionalContext: `${buildCurrentTaskContext(getActiveTask(cwd))} ${additionalNotes.join(" ")}`
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

function shouldBlockStop(payload, activeTask) {
  if (!activeTask) {
    return false;
  }

  if (["done", "failed", "suspended"].includes(activeTask.current_state)) {
    return false;
  }

  const message = String(payload?.last_assistant_message ?? "").trim().toLowerCase();
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
