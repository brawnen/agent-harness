import {
  getActiveTask,
  initTaskState,
  resolveActiveTaskId,
  requireTaskState,
  setActiveTaskId,
  updateTaskState
} from "./state-store.js";
import { loadProjectConfig } from "./project-config.js";
import { normalizeOutputPolicy } from "./output-policy.js";
import { evaluateTaskWorkflowDecision, normalizeWorkflowPolicy } from "./workflow-policy.js";

const CONTINUE_KEYWORDS = [
  "继续",
  "继续推进",
  "继续做",
  "按刚才",
  "基于刚才",
  "补测试",
  "补一下测试",
  "修一下",
  "修掉",
  "continue",
  "follow up",
  "follow-up"
];

const AFFIRMATIVE_SHORT_REPLIES = [
  "ok", "okay", "好", "好的", "嗯", "对", "是的", "可以",
  "行", "没问题", "同意", "确认", "yes", "yep", "sure", "lgtm",
  "先这样", "就这样", "开始吧", "搞起", "go"
];

const TASK_REFERENCE_KEYWORDS = [
  "刚才那个",
  "刚才这个",
  "刚才的任务",
  "这个任务",
  "这个问题",
  "这个方案",
  "当前任务",
  "前面那个"
];

const TASK_REPLY_PREFIXES = [
  "先做",
  "先看",
  "先把",
  "先",
  "再",
  "然后",
  "接着",
  "列一下",
  "看一下",
  "看看",
  "全部",
  "只",
  "统一",
  "收敛成",
  "按这个",
  "就按这个",
  "好，",
  "好,",
  "那就"
];

const NEW_TASK_KEYWORDS = [
  "新任务",
  "另一个问题",
  "另外一个问题",
  "另外",
  "还有个问题",
  "顺便",
  "再做",
  "new task",
  "another task",
  "another issue"
];

const EXPLORE_KEYWORDS = ["调研", "解释", "分析", "看一下", "看看", "explore", "investigate"];
const BUG_KEYWORDS = ["bug", "报错", "错误", "异常", "修复", "fix", "error"];
const REFACTOR_KEYWORDS = ["重构", "refactor", "整理", "收敛结构"];
const PROTOTYPE_KEYWORDS = ["原型", "poc", "prototype", "草稿", "快速验证"];
const HIGH_RISK_KEYWORDS = ["rm -rf", "删除", "drop database", "reset --hard", ".idea/", "生产"];
const MANUAL_CONFIRMATION_KEYWORDS = [
  "确认继续",
  "继续执行",
  "可以继续",
  "继续吧",
  "我确认",
  "确认，可以",
  "允许继续",
  "就按这个做",
  "按这个做",
  "go ahead",
  "proceed"
];
const FORCE_OVERRIDE_KEYWORDS = [
  "别问了直接做",
  "直接做",
  "跳过验证",
  "跳过确认",
  "跳过澄清",
  "不用确认",
  "无需确认",
  "不要再问",
  "先别验证",
  "skip verification",
  "skip verify",
  "force override"
];

export function buildTaskDraftFromInput(sourceInput, options = {}) {
  const input = String(sourceInput ?? "").trim();
  if (!input) {
    throw new Error("缺少任务描述");
  }

  const scope = normalizeArray(options.scope);
  const acceptance = normalizeArray(options.acceptance);
  const openQuestions = [];
  const riskSignals = [];

  if (scope.length === 0) {
    openQuestions.push("当前任务的作用范围仍未明确，需要先澄清允许修改的模块、目录或主题。");
  }

  if (acceptance.length === 0) {
    openQuestions.push("当前任务的完成标准仍未明确，需要先澄清 acceptance。");
  }

  const riskLevel = inferRiskLevel(input, riskSignals);
  const intent = options.intent ?? inferIntent(input);
  const mode = options.mode ?? (intent === "explore" ? "explore" : "delivery");
  const hasOpenQuestions = openQuestions.length > 0;
  const nextAction = hasOpenQuestions
    ? (riskLevel === "high" ? "clarify" : "observe")
    : "plan";
  const derivedState = hasOpenQuestions
    ? (riskLevel === "high" ? "needs_clarification" : "draft")
    : "planned";

  return {
    schema_version: "0.3",
    source_input: input,
    intent,
    goal: options.goal ?? input,
    scope: scope.length > 0 ? scope : ["待澄清作用范围"],
    acceptance: acceptance.length > 0 ? acceptance : ["待澄清完成标准"],
    title: options.title ?? null,
    constraints: normalizeArray(options.constraints),
    assumptions: normalizeArray(options.assumptions),
    open_questions: openQuestions,
    risk_signals: riskSignals,
    context_refs: normalizeArray(options.contextRefs),
    next_action: nextAction,
    mode,
    derived: {
      risk_level: riskLevel,
      state: derivedState
    }
  };
}

export function createTaskFromInput(cwd, sourceInput, options = {}) {
  if (options.suspendActive) {
    suspendActiveTask(cwd, {
      reason: options.suspendReason ?? "当前输入被识别为新任务，旧任务已挂起。",
      clearActive: false
    });
  }

  const taskDraft = buildTaskDraftFromInput(sourceInput, options);
  const projectConfig = loadProjectConfig(cwd);
  const workflowDecision = evaluateTaskWorkflowDecision({
    task_id: options.taskId ?? null,
    current_state: taskDraft?.derived?.state ?? "draft",
    task_draft: taskDraft,
    confirmed_contract: null,
    override_history: []
  }, {
    workflowPolicy: normalizeWorkflowPolicy(projectConfig?.workflow_policy),
    outputPolicy: normalizeOutputPolicy(projectConfig?.output_policy)
  });
  return initTaskState(cwd, {
    taskDraft,
    taskId: options.taskId,
    workflowDecision
  });
}

export function suspendActiveTask(cwd, options = {}) {
  const activeTaskId = options.taskId ?? resolveActiveTaskId(cwd);
  if (!activeTaskId) {
    return {
      changed: false,
      cleared_active_task: false,
      reason: "当前无活跃任务",
      task_id: null
    };
  }

  const taskState = requireTaskState(cwd, activeTaskId);
  const clearActive = options.clearActive ?? true;

  if (taskState.current_state === "suspended") {
    if (clearActive) {
      setActiveTaskId(cwd, null);
    }
    return {
      changed: false,
      cleared_active_task: clearActive,
      reason: "活跃任务已处于 suspended",
      task_id: activeTaskId,
      task_state: taskState
    };
  }

  if (taskState.current_state === "done" || taskState.current_state === "failed") {
    if (clearActive) {
      setActiveTaskId(cwd, null);
    }
    return {
      changed: false,
      cleared_active_task: clearActive,
      reason: `当前任务已是 ${taskState.current_state}，无需挂起`,
      task_id: activeTaskId,
      task_state: taskState
    };
  }

  const evidence = options.reason
    ? [{
        type: "reasoning_note",
        content: options.reason,
        timestamp: new Date().toISOString()
      }]
    : [];

  const updatedTask = updateTaskState(cwd, activeTaskId, {
    current_state: "suspended",
    evidence
  });

  if (clearActive) {
    setActiveTaskId(cwd, null);
  }

  return {
    changed: true,
    cleared_active_task: clearActive,
    task_id: activeTaskId,
    task_state: updatedTask
  };
}

export function autoIntakePrompt(cwd, prompt) {
  const input = String(prompt ?? "").trim();
  if (!input) {
    return {
      action: "noop",
      additionalContext: "",
      decision: buildDecision("noop", {
        reasonCode: "empty_prompt",
        reason: "当前输入为空，不触发自动 intake。",
        confidence: "high"
      })
    };
  }

  const activeTask = getActiveTask(cwd);
  if (!activeTask) {
    const createdTask = createTaskFromInput(cwd, input, { suspendActive: false });
    return {
      action: "created",
      task: createdTask,
      additionalContext: buildNewTaskContext(createdTask),
      decision: buildDecision("new", {
        reasonCode: "no_active_task",
        reason: "当前没有 active task，自动创建新任务。",
        confidence: "high"
      })
    };
  }

  const decision = classifyPromptAgainstTask(input, activeTask);
  if (decision.type === "continue" || decision.type === "provisional_continue") {
    return {
      action: "continue",
      task: activeTask,
      additionalContext: "",
      decision
    };
  }

  if (decision.type === "clarify") {
    return {
      action: "clarify",
      task: activeTask,
      block: decision.block,
      reason: decision.reason,
      additionalContext: decision.reason,
      decision
    };
  }

  suspendActiveTask(cwd, {
    reason: "Codex UserPromptSubmit 将当前输入判定为新任务，旧任务已自动挂起。",
    clearActive: false
  });

  const createdTask = createTaskFromInput(cwd, input, { suspendActive: false });
  return {
    action: "created",
    task: createdTask,
    additionalContext: buildNewTaskContext(createdTask),
    decision
  };
}

export function buildCurrentTaskContext(taskState) {
  if (!taskState) {
    return "";
  }

  const goal = taskState?.confirmed_contract?.goal ?? taskState?.task_draft?.goal ?? "未定义目标";
  const blockingQuestion = Array.isArray(taskState?.open_questions) && taskState.open_questions.length > 0
    ? ` 阻断：${taskState.open_questions[0]}`
    : "";

  return `当前任务 ${taskState.task_id}：${goal}。${blockingQuestion}`.trim();
}

export function buildNewTaskContext(taskState) {
  if (!taskState) {
    return "";
  }

  const draft = taskState.task_draft ?? {};
  return `已切换到新任务 ${taskState.task_id}：${draft.goal}。`;
}

export function classifyUserOverridePrompt(prompt) {
  const normalizedPrompt = String(prompt ?? "").trim().toLowerCase();
  if (!normalizedPrompt) {
    return null;
  }

  const matchedForceOverrideKeyword = findMatchedKeyword(normalizedPrompt, FORCE_OVERRIDE_KEYWORDS);
  if (matchedForceOverrideKeyword) {
    return {
      type: "force_override",
      reason_code: "matched_force_override_keyword",
      reason: `输入命中 force override 关键词：${matchedForceOverrideKeyword}。`,
      matched_signals: [`keyword:${matchedForceOverrideKeyword}`],
      confidence: "high"
    };
  }

  const matchedManualConfirmationKeyword = findMatchedKeyword(normalizedPrompt, MANUAL_CONFIRMATION_KEYWORDS);
  if (matchedManualConfirmationKeyword) {
    return {
      type: "manual_confirmation",
      reason_code: "matched_manual_confirmation_keyword",
      reason: `输入命中人工确认关键词：${matchedManualConfirmationKeyword}。`,
      matched_signals: [`keyword:${matchedManualConfirmationKeyword}`],
      confidence: "medium"
    };
  }

  return null;
}

function classifyPromptAgainstTask(prompt, activeTask) {
  const normalizedPrompt = prompt.toLowerCase();
  const activeGoal = String(activeTask?.confirmed_contract?.goal ?? activeTask?.task_draft?.goal ?? "").toLowerCase();
  const activeScope = normalizeArray(activeTask?.confirmed_contract?.scope ?? activeTask?.task_draft?.scope).map((item) => item.toLowerCase());
  const currentState = activeTask?.current_state ?? "unknown";

  if (["done", "failed", "suspended"].includes(currentState)) {
    return buildDecision("new", {
      reasonCode: "inactive_active_task_state",
      reason: `当前 active task 状态为 ${currentState}，自动按新任务处理。`,
      matchedSignals: [`active_state:${currentState}`],
      confidence: "high"
    });
  }

  const matchedNewKeyword = findMatchedKeyword(normalizedPrompt, NEW_TASK_KEYWORDS);
  if (matchedNewKeyword) {
    return buildDecision("new", {
      reasonCode: "matched_new_task_keyword",
      reason: `输入命中新任务关键词：${matchedNewKeyword}。`,
      matchedSignals: [`keyword:${matchedNewKeyword}`],
      confidence: "high"
    });
  }

  const matchedContinueKeyword = findMatchedKeyword(normalizedPrompt, CONTINUE_KEYWORDS);
  if (matchedContinueKeyword) {
    return buildDecision("continue", {
      reasonCode: "matched_continue_keyword",
      reason: `输入命中续写关键词：${matchedContinueKeyword}。`,
      matchedSignals: [`keyword:${matchedContinueKeyword}`],
      confidence: "high"
    });
  }

  const activeGoalFragment = activeGoal.slice(0, Math.min(activeGoal.length, 12)).trim();
  if (activeGoalFragment && normalizedPrompt.includes(activeGoalFragment)) {
    return buildDecision("continue", {
      reasonCode: "matched_active_goal_fragment",
      reason: `输入命中当前任务目标片段：${activeGoalFragment}。`,
      matchedSignals: [`goal_fragment:${activeGoalFragment}`],
      confidence: "medium"
    });
  }

  const matchedScope = activeScope.find((scopeItem) => (
    scopeItem &&
    scopeItem !== "待澄清作用范围" &&
    normalizedPrompt.includes(scopeItem)
  ));
  if (matchedScope) {
    return buildDecision("continue", {
      reasonCode: "matched_active_scope",
      reason: `输入命中当前任务 scope：${matchedScope}。`,
      matchedSignals: [`scope:${matchedScope}`],
      confidence: "medium"
    });
  }

  if (isAffirmativeShortReply(normalizedPrompt)) {
    return buildDecision("continue", {
      reasonCode: "affirmative_short_reply",
      reason: "输入为确认性短回复，视为延续当前任务。",
      matchedSignals: ["affirmative_short_reply"],
      confidence: "medium"
    });
  }

  const matchedTaskReference = TASK_REFERENCE_KEYWORDS.find((keyword) => normalizedPrompt.includes(keyword));
  if (matchedTaskReference) {
    return buildDecision("continue", {
      reasonCode: "matched_task_reference",
      reason: `输入命中当前任务指代：${matchedTaskReference}。`,
      matchedSignals: [`task_reference:${matchedTaskReference}`],
      confidence: "medium"
    });
  }

  if (isLikelyTaskReply(normalizedPrompt)) {
    return buildDecision("provisional_continue", {
      reasonCode: "likely_task_reply",
      reason: "输入更像是当前任务内的步骤选择或简短回复，先续接当前任务观察。",
      matchedSignals: ["likely_task_reply"],
      confidence: "low"
    });
  }

  const ambiguous = isAmbiguousPrompt(prompt);
  if (ambiguous) {
    const matchedHighRiskKeyword = findMatchedKeyword(normalizedPrompt, HIGH_RISK_KEYWORDS);
    const highRisk = Boolean(matchedHighRiskKeyword);
    if (highRisk) {
      return buildDecision("clarify", {
        block: true,
        reasonCode: "ambiguous_high_risk_prompt",
        reason: "输入任务归属不明且含高风险信号，请先澄清。",
        matchedSignals: [`high_risk_keyword:${matchedHighRiskKeyword}`, "ambiguous_prompt"],
        confidence: "high"
      });
    }

    return buildDecision("provisional_continue", {
      reasonCode: "ambiguous_low_risk_continue",
      reason: "输入较短且无高风险信号，先按当前任务续接并观察。",
      matchedSignals: ["ambiguous_prompt", "low_risk"],
      confidence: "low"
    });
  }

  return buildDecision("new", {
    reasonCode: "fallback_new_task",
    reason: "未命中续写信号，且输入不属于歧义短句，按新任务处理。",
    matchedSignals: ["fallback_new_task"],
    confidence: "low"
  });
}

function isAmbiguousPrompt(prompt) {
  const normalized = String(prompt ?? "").trim();
  if (normalized.length <= 8) {
    return true;
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length <= 2 && normalized.length <= 18) {
    return true;
  }

  return ["看一下这个", "有个问题", "帮我处理一下", "处理下", "看看这个"].some((text) => normalized.includes(text));
}

function isAffirmativeShortReply(normalizedPrompt) {
  const trimmed = normalizedPrompt.trim();
  return AFFIRMATIVE_SHORT_REPLIES.some((reply) => trimmed === reply);
}

function isLikelyTaskReply(normalizedPrompt) {
  const trimmed = normalizedPrompt.trim();
  return TASK_REPLY_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

function inferIntent(input) {
  const normalized = input.toLowerCase();
  if (EXPLORE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "explore";
  }
  if (BUG_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "bug";
  }
  if (REFACTOR_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "refactor";
  }
  if (PROTOTYPE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "prototype";
  }
  return "feature";
}

function inferRiskLevel(input, riskSignals) {
  const normalized = input.toLowerCase();
  for (const keyword of HIGH_RISK_KEYWORDS) {
    if (normalized.includes(keyword)) {
      riskSignals.push(`命中高风险关键词: ${keyword}`);
      return "high";
    }
  }
  return "low";
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  }
  if (value == null) {
    return [];
  }
  return [String(value).trim()].filter(Boolean);
}

function buildDecision(type, options = {}) {
  return {
    type,
    block: options.block ?? false,
    reason_code: options.reasonCode ?? "unspecified",
    reason: options.reason ?? "",
    matched_signals: Array.isArray(options.matchedSignals) ? options.matchedSignals : [],
    confidence: options.confidence ?? "low"
  };
}

function findMatchedKeyword(input, keywords) {
  return keywords.find((keyword) => input.includes(keyword)) ?? null;
}

function deriveNextAction(taskState) {
  const phase = taskState?.current_phase ?? null;
  if (phase && ["clarify", "plan", "execute", "verify", "report", "close"].includes(phase)) {
    return phase;
  }
  return taskState?.task_draft?.next_action ?? "plan";
}
