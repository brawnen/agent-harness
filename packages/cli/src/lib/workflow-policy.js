import { evaluateTaskArtifactPolicy, normalizeOutputPolicy } from "./output-policy.js";

const DEFAULT_FORCE_FULL_INTENTS = ["bug", "feature", "refactor"];

export function normalizeWorkflowPolicy(value) {
  const policy = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const enforcement = policy.enforcement && typeof policy.enforcement === "object" && !Array.isArray(policy.enforcement)
    ? policy.enforcement
    : {};
  const liteAllowedIf = policy.lite_allowed_if && typeof policy.lite_allowed_if === "object" && !Array.isArray(policy.lite_allowed_if)
    ? policy.lite_allowed_if
    : {};
  const forceFullIf = policy.force_full_if && typeof policy.force_full_if === "object" && !Array.isArray(policy.force_full_if)
    ? policy.force_full_if
    : {};

  return {
    default_mode: typeof policy.default_mode === "string" ? policy.default_mode : "full",
    lite_allowed_if: {
      single_file: liteAllowedIf.single_file !== false,
      low_risk: liteAllowedIf.low_risk !== false,
      docs_only: liteAllowedIf.docs_only !== false,
      no_behavior_change: liteAllowedIf.no_behavior_change !== false,
      no_policy_change: liteAllowedIf.no_policy_change !== false,
      no_output_artifacts: liteAllowedIf.no_output_artifacts !== false
    },
    force_full_if: {
      intents: Array.isArray(forceFullIf.intents)
        ? forceFullIf.intents.map((item) => String(item))
        : DEFAULT_FORCE_FULL_INTENTS,
      multi_file_scope: forceFullIf.multi_file_scope !== false,
      config_changed: forceFullIf.config_changed !== false,
      protocol_changed: forceFullIf.protocol_changed !== false,
      host_adapter_changed: forceFullIf.host_adapter_changed !== false,
      output_artifact_required: forceFullIf.output_artifact_required !== false,
      high_risk: forceFullIf.high_risk !== false,
      override_used: forceFullIf.override_used !== false
    },
    enforcement: {
      mode: typeof enforcement.mode === "string" ? enforcement.mode : "recommend",
      upgrade_only: enforcement.upgrade_only !== false
    }
  };
}

export function evaluateTaskWorkflowDecision(taskState, options = {}) {
  const workflowPolicy = normalizeWorkflowPolicy(options.workflowPolicy);
  const outputPolicy = normalizeOutputPolicy(options.outputPolicy);
  const previousDecision = normalizeWorkflowDecision(options.previousDecision ?? taskState?.workflow_decision);
  const context = buildWorkflowContext(taskState, options);
  const artifactRequirements = evaluateTaskArtifactPolicy(taskState, outputPolicy);
  const requiredArtifacts = Object.values(artifactRequirements)
    .filter((artifact) => artifact.required)
    .map((artifact) => artifact.name);

  const fullReasons = collectFullReasons(context, workflowPolicy, requiredArtifacts);
  const liteReasons = collectLiteReasons(context, workflowPolicy, requiredArtifacts);
  const recommendedMode = fullReasons.length > 0 || liteReasons.length === 0
    ? "full"
    : "lite";
  const recommendedReasons = recommendedMode === "full" ? fullReasons : liteReasons;

  let effectiveMode = recommendedMode;
  let upgradedFrom = null;
  let reasons = recommendedReasons;

  if (workflowPolicy.enforcement.upgrade_only && previousDecision?.effective_mode === "full" && recommendedMode === "lite") {
    effectiveMode = "full";
    reasons = Array.isArray(previousDecision.reasons) && previousDecision.reasons.length > 0
      ? previousDecision.reasons
      : ["upgrade_only_preserved_full"];
  }

  if (previousDecision?.effective_mode === "lite" && effectiveMode === "full") {
    upgradedFrom = "lite";
  }

  return {
    recommended_mode: recommendedMode,
    effective_mode: effectiveMode,
    upgraded_from: upgradedFrom,
    reasons,
    enforcement_mode: workflowPolicy.enforcement.mode,
    evaluated_at: new Date().toISOString()
  };
}

export function buildWorkflowWarning(decision) {
  if (!decision || typeof decision !== "object") {
    return null;
  }

  if (decision.enforcement_mode !== "warn") {
    return null;
  }

  if (decision.effective_mode !== "full") {
    return null;
  }

  const reasons = Array.isArray(decision.reasons)
    ? decision.reasons.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
  if (reasons.length === 0) {
    return null;
  }

  if (decision.upgraded_from === "lite") {
    return `当前任务已从 lite 升级为 full workflow，建议按完整链路收口（原因: ${reasons.join(", ")}）`;
  }

  return `当前任务命中 full workflow，建议按完整链路收口（原因: ${reasons.join(", ")}）`;
}

function buildWorkflowContext(taskState, options) {
  const contract = taskState?.confirmed_contract ?? {};
  const draft = taskState?.task_draft ?? {};
  const scopeSource = Array.isArray(options.actualScope) && options.actualScope.length > 0
    ? options.actualScope
    : (contract.scope ?? draft.scope);
  const scope = normalizeStringArray(scopeSource);
  const goal = String(contract.goal ?? draft.goal ?? "");
  const intent = String(contract.intent ?? draft.intent ?? "unknown");
  const riskLevel = String(contract.risk_level ?? draft?.derived?.risk_level ?? "medium");
  const overrideUsed = Array.isArray(taskState?.override_history) && taskState.override_history.length > 0;

  return {
    goal,
    intent,
    risk_level: riskLevel,
    scope,
    multi_file_scope: inferMultiFileScope(scope),
    single_file_scope: inferSingleFileScope(scope),
    docs_only: inferDocsOnly(scope),
    config_changed: inferConfigChanged(scope),
    protocol_changed: inferProtocolChanged(scope),
    host_adapter_changed: inferHostAdapterChanged(scope),
    override_used: overrideUsed
  };
}

function collectFullReasons(context, workflowPolicy, requiredArtifacts) {
  const reasons = [];
  const rules = workflowPolicy.force_full_if;

  if (rules.intents.includes(context.intent)) {
    reasons.push(`intent:${context.intent}`);
  }
  if (rules.multi_file_scope && context.multi_file_scope) {
    reasons.push("multi_file_scope");
  }
  if (rules.config_changed && context.config_changed) {
    reasons.push("config_changed");
  }
  if (rules.protocol_changed && context.protocol_changed) {
    reasons.push("protocol_changed");
  }
  if (rules.host_adapter_changed && context.host_adapter_changed) {
    reasons.push("host_adapter_changed");
  }
  if (rules.output_artifact_required && requiredArtifacts.length > 0) {
    reasons.push(`output_artifact_required:${requiredArtifacts.join(",")}`);
  }
  if (rules.high_risk && context.risk_level === "high") {
    reasons.push("high_risk");
  }
  if (rules.override_used && context.override_used) {
    reasons.push("override_used");
  }

  return reasons;
}

function collectLiteReasons(context, workflowPolicy, requiredArtifacts) {
  const conditions = workflowPolicy.lite_allowed_if;
  const reasons = [];

  if (conditions.single_file && !context.single_file_scope) {
    return [];
  }
  if (conditions.single_file) {
    reasons.push("single_file_scope");
  }

  if (conditions.low_risk && context.risk_level !== "low") {
    return [];
  }
  if (conditions.low_risk) {
    reasons.push("low_risk");
  }

  if (conditions.docs_only && !context.docs_only) {
    return [];
  }
  if (conditions.docs_only) {
    reasons.push("docs_only");
  }

  if (conditions.no_behavior_change && !context.docs_only) {
    return [];
  }
  if (conditions.no_behavior_change) {
    reasons.push("no_behavior_change");
  }

  if (conditions.no_policy_change && (context.config_changed || context.protocol_changed || context.host_adapter_changed)) {
    return [];
  }
  if (conditions.no_policy_change) {
    reasons.push("no_policy_change");
  }

  if (conditions.no_output_artifacts && requiredArtifacts.length > 0) {
    return [];
  }
  if (conditions.no_output_artifacts) {
    reasons.push("no_output_artifacts");
  }

  if (context.override_used) {
    return [];
  }

  return reasons;
}

function inferSingleFileScope(scope) {
  if (scope.length !== 1) {
    return false;
  }
  return !looksLikeDirectory(scope[0]);
}

function inferMultiFileScope(scope) {
  if (scope.length > 1) {
    return true;
  }
  return scope.some((item) => looksLikeDirectory(item));
}

function inferDocsOnly(scope) {
  if (scope.length === 0) {
    return false;
  }
  return scope.every((item) => {
    const normalized = String(item).replace(/^\.\//, "");
    return normalized === "CHANGELOG.md" ||
      normalized.startsWith("docs/") ||
      normalized.endsWith(".md");
  });
}

function inferConfigChanged(scope) {
  return scope.some((item) => {
    const normalized = String(item).replace(/^\.\//, "");
    return normalized === "harness.yaml" ||
      normalized === "package.json" ||
      normalized.endsWith(".schema.json");
  });
}

function inferProtocolChanged(scope) {
  return scope.some((item) => {
    const normalized = String(item).replace(/^\.\//, "");
    return normalized.startsWith("packages/protocol/") ||
      normalized === "AGENTS.md" ||
      normalized === "CLAUDE.md" ||
      normalized === "GEMINI.md";
  });
}

function inferHostAdapterChanged(scope) {
  return scope.some((item) => {
    const normalized = String(item).replace(/^\.\//, "");
    return normalized.startsWith(".codex/") ||
      normalized.startsWith(".claude/") ||
      normalized.startsWith("packages/protocol/adapters/");
  });
}

function looksLikeDirectory(value) {
  const normalized = String(value ?? "");
  return normalized.endsWith("/") || normalized.endsWith("/**") || !pathLikeLeaf(normalized);
}

function pathLikeLeaf(value) {
  const normalized = String(value ?? "");
  const lastSegment = normalized.split("/").pop() ?? "";
  return lastSegment.includes(".");
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function normalizeWorkflowDecision(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
}
