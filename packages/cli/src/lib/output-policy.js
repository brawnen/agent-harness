import fs from "node:fs";
import path from "node:path";

export function normalizeOutputPolicy(value) {
  const policy = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    report: normalizeReportPolicy(policy.report),
    changelog: normalizeChangelogPolicy(policy.changelog),
    design_note: normalizeArtifactPolicy(policy.design_note, "docs/"),
    adr: normalizeArtifactPolicy(policy.adr, "docs/")
  };
}

export function evaluateTaskArtifactPolicy(taskState, outputPolicy) {
  const normalizedPolicy = normalizeOutputPolicy(outputPolicy);
  const taskContext = buildTaskContext(taskState);

  return {
    changelog: evaluateChangelogRequirement(normalizedPolicy.changelog, taskContext),
    design_note: evaluateArtifactRequirement("design_note", normalizedPolicy.design_note, taskContext),
    adr: evaluateArtifactRequirement("adr", normalizedPolicy.adr, taskContext)
  };
}

export function validateTaskOutputArtifacts(cwd, taskState, outputPolicy, artifactInputs = {}) {
  const requirements = evaluateTaskArtifactPolicy(taskState, outputPolicy);
  const artifacts = {
    changelog: validateChangelogArtifact(cwd, requirements.changelog, artifactInputs.changelog),
    design_note: validateDocumentArtifact(cwd, "design_note", requirements.design_note, artifactInputs.design_note),
    adr: validateDocumentArtifact(cwd, "adr", requirements.adr, artifactInputs.adr)
  };

  const missingRequired = Object.entries(artifacts)
    .filter(([, artifact]) => artifact.required && !artifact.satisfied)
    .map(([, artifact]) => artifact.name);

  if (missingRequired.length > 0) {
    throw new Error(`缺少必需输出工件: ${missingRequired.join(", ")}`);
  }

  return artifacts;
}

export function inspectOutputPolicyWorkspace(cwd, outputPolicy) {
  const normalizedPolicy = normalizeOutputPolicy(outputPolicy);
  const summary = [];
  const warnings = [];

  if (normalizedPolicy.report) {
    summary.push(`report=${normalizedPolicy.report.format}@${normalizedPolicy.report.directory}`);
  }

  if (normalizedPolicy.changelog.mode !== "disabled") {
    summary.push(`changelog=${normalizedPolicy.changelog.mode}`);
    if (!fs.existsSync(path.join(cwd, normalizedPolicy.changelog.file))) {
      warnings.push(`缺少 changelog 文件: ${normalizedPolicy.changelog.file}`);
    }
  }

  if (normalizedPolicy.design_note.mode !== "disabled") {
    summary.push(`design_note=${normalizedPolicy.design_note.mode}`);
    if (!fs.existsSync(path.join(cwd, normalizedPolicy.design_note.directory))) {
      warnings.push(`缺少 design_note 目录: ${normalizedPolicy.design_note.directory}`);
    }
  }

  if (normalizedPolicy.adr.mode !== "disabled") {
    summary.push(`adr=${normalizedPolicy.adr.mode}`);
    if (!fs.existsSync(path.join(cwd, normalizedPolicy.adr.directory))) {
      warnings.push(`缺少 adr 目录: ${normalizedPolicy.adr.directory}`);
    }
  }

  return {
    summary: summary.join(", "),
    warnings
  };
}

function normalizeReportPolicy(value) {
  const policy = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    required: policy.required !== false,
    format: typeof policy.format === "string" ? policy.format : "json",
    directory: typeof policy.directory === "string" ? policy.directory : "harness/reports",
    required_sections: Array.isArray(policy.required_sections)
      ? policy.required_sections.map((item) => String(item))
      : []
  };
}

function normalizeChangelogPolicy(value) {
  const policy = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    mode: normalizeMode(policy.mode),
    file: typeof policy.file === "string" ? policy.file : "CHANGELOG.md",
    required_for: Array.isArray(policy.required_for) ? policy.required_for.map((item) => String(item)) : [],
    skip_if: Array.isArray(policy.skip_if) ? policy.skip_if : []
  };
}

function normalizeArtifactPolicy(value, defaultDirectory) {
  const policy = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    mode: normalizeMode(policy.mode),
    directory: typeof policy.directory === "string" ? policy.directory : defaultDirectory,
    required_if: Array.isArray(policy.required_if) ? policy.required_if : []
  };
}

function normalizeMode(value) {
  return typeof value === "string" ? value : "disabled";
}

function buildTaskContext(taskState) {
  const contract = taskState?.confirmed_contract ?? {};
  const draft = taskState?.task_draft ?? {};
  return {
    goal: String(contract.goal ?? draft.goal ?? ""),
    intent: String(contract.intent ?? draft.intent ?? "unknown"),
    risk_level: String(contract.risk_level ?? draft?.derived?.risk_level ?? "medium"),
    scope: normalizeStringArray(contract.scope ?? draft.scope)
  };
}

function evaluateChangelogRequirement(policy, taskContext) {
  const requiredByMode = policy.mode === "required";
  const requiredByCondition = policy.mode === "conditional" &&
    policy.required_for.includes(taskContext.intent) &&
    !policy.skip_if.some((condition) => matchesObjectCondition(condition, taskContext));

  return {
    file: policy.file,
    mode: policy.mode,
    name: "changelog",
    required: requiredByMode || requiredByCondition
  };
}

function evaluateArtifactRequirement(name, policy, taskContext) {
  return {
    directory: policy.directory,
    mode: policy.mode,
    name,
    required: policy.mode === "required" || (
      policy.mode === "conditional" &&
      policy.required_if.some((condition) => matchesArtifactCondition(condition, taskContext))
    )
  };
}

function validateChangelogArtifact(cwd, requirement, explicitPath) {
  const resolvedPath = explicitPath ?? requirement.file;
  const absolutePath = path.join(cwd, resolvedPath);
  const exists = fs.existsSync(absolutePath);
  return {
    name: requirement.name,
    path: resolvedPath,
    required: requirement.required,
    satisfied: exists,
    reason: requirement.required
      ? (exists ? "满足 changelog 要求" : `缺少 changelog 文件: ${resolvedPath}`)
      : (exists ? "检测到 changelog 文件" : "当前任务不强制要求 changelog")
  };
}

function validateDocumentArtifact(cwd, name, requirement, explicitPath) {
  if (!explicitPath) {
    return {
      name,
      path: null,
      required: requirement.required,
      satisfied: false,
      reason: requirement.required
        ? `缺少 --${name.replace("_", "-")} 参数`
        : `当前任务不强制要求 ${name}`
    };
  }

  const absolutePath = path.join(cwd, explicitPath);
  const exists = fs.existsSync(absolutePath);
  return {
    name,
    path: explicitPath,
    required: requirement.required,
    satisfied: exists,
    reason: exists ? `已提供 ${name}` : `${name} 文件不存在: ${explicitPath}`
  };
}

function matchesArtifactCondition(condition, taskContext) {
  if (typeof condition === "string") {
    const normalized = condition.trim().toLowerCase();
    if (normalized === "cross_module_change") {
      return inferCrossModuleChange(taskContext.scope);
    }
    if (normalized === "public_contract_changed") {
      return hasKeyword(taskContext.goal, ["api", "schema", "接口", "契约", "协议", "contract"]);
    }
    if (normalized === "reusable_decision") {
      return hasKeyword(taskContext.goal, ["复用", "通用", "shared", "reusable"]);
    }
    if (normalized === "architectural_decision") {
      return hasKeyword(taskContext.goal, ["架构", "architecture", "协议", "adapter", "hook"]);
    }
    if (normalized === "policy_change") {
      return hasKeyword(taskContext.goal, ["策略", "policy", "规则"]);
    }
    if (normalized === "protocol_change") {
      return hasKeyword(taskContext.goal, ["协议", "protocol"]);
    }
    if (normalized === "host_adapter_contract_change") {
      return hasKeyword(taskContext.goal, ["adapter", "适配", "hook", "codex", "claude", "gemini"]);
    }
    return false;
  }

  if (condition && typeof condition === "object" && !Array.isArray(condition)) {
    return matchesObjectCondition(condition, taskContext);
  }

  return false;
}

function matchesObjectCondition(condition, taskContext) {
  return Object.entries(condition).every(([key, value]) => {
    if (key === "intent") {
      return taskContext.intent === String(value);
    }
    if (key === "risk_level") {
      return taskContext.risk_level === String(value);
    }
    return false;
  });
}

function inferCrossModuleChange(scope) {
  const modules = new Set();
  for (const item of scope) {
    if (!item || item === "待澄清作用范围") {
      continue;
    }

    const firstSegment = item.replace(/^\.\//, "").split("/")[0];
    if (firstSegment) {
      modules.add(firstSegment);
    }
  }
  return modules.size >= 2;
}

function hasKeyword(text, keywords) {
  const normalized = String(text ?? "").toLowerCase();
  return keywords.some((keyword) => normalized.includes(String(keyword).toLowerCase()));
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item)).filter(Boolean);
}
