import { appendAuditEntry, readAuditEntries } from "../../packages/cli/src/lib/audit-store.js";
import {
  autoIntakePrompt,
  buildCurrentTaskContext,
  classifyUserOverridePrompt
} from "../../packages/cli/src/lib/task-core.js";
import { appendTaskOverride, getActiveTask } from "../../packages/cli/src/lib/state-store.js";
import {
  buildManualFallbackContext,
  readHookPayload,
  resolvePayloadCwd,
  resolvePayloadPrompt,
  writeBlock,
  writeContinue
} from "./shared/codex-hook-io.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const prompt = resolvePayloadPrompt(payload);

  if (!prompt.trim()) {
    writeContinue("UserPromptSubmit");
    process.exit(0);
  }

  const overrideHandled = handleUserOverridePrompt(cwd, prompt);
  if (overrideHandled) {
    writeContinue("UserPromptSubmit", overrideHandled.additionalContext);
    process.exit(0);
  }

  const result = autoIntakePrompt(cwd, prompt);
  if (result.block) {
    writeBlock(result.reason ?? "当前输入需要先澄清任务归属。");
    process.exit(0);
  }

  writeContinue("UserPromptSubmit", result.additionalContext);
} catch (error) {
  writeContinue("UserPromptSubmit", buildManualFallbackContext(`Codex 自动 intake 失败：${error.message}`, {
    commands: [
      "node packages/cli/bin/agent-harness.js task intake \"任务描述\"",
      "node packages/cli/bin/agent-harness.js task suspend-active --reason \"切换任务\"",
      "node packages/cli/bin/agent-harness.js state active"
    ]
  }));
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
      description: "用户在 Codex UserPromptSubmit 中确认继续执行当前高风险任务。",
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
    description: "用户在 Codex UserPromptSubmit 中显式要求跳过当前门禁并继续执行。",
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
