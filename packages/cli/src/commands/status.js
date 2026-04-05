import fs from "node:fs";
import path from "node:path";

import { evaluateTaskDeliveryReadiness, summarizeDeliveryReadiness } from "../lib/delivery-policy.js";
import { evaluateTaskArtifactPolicy, inspectOutputPolicyWorkspace, normalizeOutputPolicy } from "../lib/output-policy.js";
import { loadProjectConfig } from "../lib/project-config.js";
import {
  hasRuntimeSetup,
  resolveRuntimeDirName,
  runtimeRelativeCandidates,
  runtimeRelativePathForCwd
} from "../lib/runtime-paths.js";
import { getActiveTask } from "../lib/state-store.js";
import { evaluateTaskWorkflowDecision, normalizeWorkflowPolicy } from "../lib/workflow-policy.js";

const REQUIRED_TEMPLATE_FILES = [
  "bug.md",
  "explore.md",
  "feature.md"
];

export function runStatus(argv) {
  if (argv.length > 0) {
    console.error(`status 不接受额外参数: ${argv.join(" ")}`);
    return 1;
  }

  const cwd = process.cwd();
  const projectName = path.basename(cwd);
  const detectedHosts = detectHosts(cwd);
  const checks = [];
  const warnings = [];
  let exitCode = 0;

  const harnessConfig = inspectHarnessConfig(cwd);
  pushCheck(checks, harnessConfig);
  exitCode = maxExitCode(exitCode, harnessConfig.severity);

  const deliveryPolicyCheck = inspectDeliveryPolicy(cwd);
  pushCheck(checks, deliveryPolicyCheck);
  exitCode = maxExitCode(exitCode, deliveryPolicyCheck.severity);

  const outputPolicyCheck = inspectOutputPolicy(cwd);
  pushCheck(checks, outputPolicyCheck);
  exitCode = maxExitCode(exitCode, outputPolicyCheck.severity);

  const artifactHintsCheck = inspectActiveTaskArtifactHints(cwd);
  pushCheck(checks, artifactHintsCheck);
  exitCode = maxExitCode(exitCode, artifactHintsCheck.severity);

  const workflowModeCheck = inspectWorkflowMode(cwd);
  pushCheck(checks, workflowModeCheck);
  exitCode = maxExitCode(exitCode, workflowModeCheck.severity);

  const hosts = detectedHosts.length > 0 ? detectedHosts : ["claude-code", "codex", "gemini-cli"];
  for (const host of hosts) {
    const hostCheck = inspectHostRules(cwd, host, detectedHosts.length === 0);
    pushCheck(checks, hostCheck);
    exitCode = maxExitCode(exitCode, hostCheck.severity);
  }

  const templatesCheck = inspectTemplates(cwd);
  pushCheck(checks, templatesCheck);
  exitCode = maxExitCode(exitCode, templatesCheck.severity);

  const runtimeMode = detectRuntimeMode(cwd);
  const codexHooksCheck = inspectCodexHooks(cwd, hosts.includes("codex"));
  pushCheck(checks, codexHooksCheck);
  exitCode = maxExitCode(exitCode, codexHooksCheck.severity);

  const claudeHooksCheck = inspectClaudeHooks(cwd, runtimeMode, hosts.includes("claude-code"));
  pushCheck(checks, claudeHooksCheck);
  exitCode = maxExitCode(exitCode, claudeHooksCheck.severity);

  const runtimeDirsCheck = inspectRuntimeDirectories(cwd, runtimeMode);
  pushCheck(checks, runtimeDirsCheck);
  exitCode = maxExitCode(exitCode, runtimeDirsCheck.severity);

  const gitignoreCheck = inspectGitignore(cwd, runtimeMode);
  pushCheck(checks, gitignoreCheck);
  exitCode = maxExitCode(exitCode, gitignoreCheck.severity);

  for (const check of checks) {
    if (check.severity === "warn") {
      warnings.push(check.message);
    } else if (check.severity === "fail") {
      warnings.push(check.message);
    }
  }

  printStatus(projectName, checks, warnings);
  return exitCode;
}

function inspectHarnessConfig(cwd) {
  const config = loadProjectConfig(cwd);
  if (!config) {
    return fail("harness.yaml", "缺失，项目尚未初始化");
  }

  const schemaVersion = config.version ?? "unknown";
  const mode = config.default_mode ?? "unknown";

  return ok("harness.yaml", `version=${schemaVersion}, default_mode=${mode}`);
}

function inspectDeliveryPolicy(cwd) {
  const config = loadProjectConfig(cwd);
  if (!config) {
    return skip("delivery_policy", "harness.yaml 缺失，无法检查");
  }

  const deliveryPolicy = config.delivery_policy ?? {};
  const commit = deliveryPolicy.commit ?? null;
  const push = deliveryPolicy.push ?? null;

  if (!commit && !push) {
    return warn("delivery_policy", "未配置 commit/push 策略");
  }

  const activeTask = getActiveTask(cwd);
  if (!activeTask) {
    const summary = [];
    if (commit) {
      summary.push(`commit=${commit.mode ?? "unknown"} via=${commit.via ?? "unknown"}`);
    }
    if (push) {
      summary.push(`push=${push.mode ?? "unknown"} via=${push.via ?? "unknown"}`);
    }

    return ok("delivery_policy", `${summary.join(", ")}；当前无 active task，暂不计算 readiness`);
  }

  const outputPolicy = normalizeOutputPolicy(config.output_policy ?? {});
  const readiness = evaluateTaskDeliveryReadiness(cwd, activeTask, {
    deliveryPolicy,
    reportPolicy: outputPolicy.report
  });

  return ok("delivery_policy", `active_task=${activeTask.task_id}；${summarizeDeliveryReadiness(readiness)}`);
}

function inspectOutputPolicy(cwd) {
  const config = loadProjectConfig(cwd);
  if (!config) {
    return skip("output_policy", "harness.yaml 缺失，无法检查");
  }

  const outputPolicy = config.output_policy ?? {};
  const normalizedPolicy = normalizeOutputPolicy(outputPolicy);
  const report = normalizedPolicy.report ?? null;

  if (!report) {
    return warn("output_policy", "未配置 output_policy.report");
  }

  const inspection = inspectOutputPolicyWorkspace(cwd, normalizedPolicy);
  if (inspection.warnings.length > 0) {
    return warn("output_policy", `${inspection.summary}；${inspection.warnings.join("；")}`);
  }

  return ok("output_policy", inspection.summary);
}

function inspectActiveTaskArtifactHints(cwd) {
  const config = loadProjectConfig(cwd);
  if (!config) {
    return skip("artifact_hints", "harness.yaml 缺失，无法检查");
  }

  const activeTask = getActiveTask(cwd);
  if (!activeTask) {
    return skip("artifact_hints", "当前无 active task");
  }

  const outputPolicy = normalizeOutputPolicy(config.output_policy ?? {});
  const requirements = evaluateTaskArtifactPolicy(activeTask, outputPolicy);
  const requiredArtifacts = Object.values(requirements).filter((artifact) => artifact.required);

  if (requiredArtifacts.length === 0) {
    return ok("artifact_hints", `active_task=${activeTask.task_id}；当前无需额外输出工件`);
  }

  const names = requiredArtifacts.map((artifact) => artifact.name);
  const hints = [];
  if (names.includes("changelog")) {
    hints.push(`更新 ${outputPolicy.changelog.file}`);
  }
  if (names.includes("design_note")) {
    const suggestedPath = path.posix.join(outputPolicy.design_note.directory, `${activeTask.task_id}-design-note.md`);
    hints.push(`docs scaffold --type design-note --task-id ${activeTask.task_id} --path ${suggestedPath}`);
  }
  if (names.includes("adr")) {
    const suggestedPath = path.posix.join(outputPolicy.adr.directory, `${activeTask.task_id}-adr.md`);
    hints.push(`docs scaffold --type adr --task-id ${activeTask.task_id} --path ${suggestedPath}`);
  }

  return warn("artifact_hints", `active_task=${activeTask.task_id}；建议补齐 ${names.join(", ")}；${hints.join("；")}`);
}

function inspectWorkflowMode(cwd) {
  const config = loadProjectConfig(cwd);
  if (!config) {
    return skip("workflow_mode", "harness.yaml 缺失，无法检查");
  }

  const activeTask = getActiveTask(cwd);
  if (!activeTask) {
    return skip("workflow_mode", "当前无 active task");
  }

  const decision = evaluateTaskWorkflowDecision(activeTask, {
    workflowPolicy: normalizeWorkflowPolicy(config.workflow_policy),
    outputPolicy: normalizeOutputPolicy(config.output_policy),
    previousDecision: activeTask.workflow_decision
  });
  const reasons = Array.isArray(decision.reasons) && decision.reasons.length > 0
    ? decision.reasons.join(", ")
    : "none";
  const upgraded = decision.upgraded_from ? `；upgraded_from=${decision.upgraded_from}` : "";

  return ok(
    "workflow_mode",
    `active_task=${activeTask.task_id}；recommended=${decision.recommended_mode}；effective=${decision.effective_mode}${upgraded}；reasons=${reasons}`
  );
}

function inspectHostRules(cwd, host, fallback) {
  const hostMap = {
    "claude-code": "CLAUDE.md",
    codex: "AGENTS.md",
    "gemini-cli": "GEMINI.md"
  };
  const fileName = hostMap[host];
  const fullPath = path.join(cwd, fileName);

  if (!fs.existsSync(fullPath)) {
    if (fallback) {
      return warn(fileName, "未检测到该宿主文件");
    }

    return fail(fileName, "缺失宿主规则文件");
  }

  const content = fs.readFileSync(fullPath, "utf8");
  const marker = content.match(/<!-- agent-harness:start version="([^"]+)" rules="([^"]+)" -->/);
  if (!marker) {
    return fail(fileName, "存在文件，但未注入 agent-harness 规则块");
  }

  const [, version, rules] = marker;
  return ok(fileName, `规则块存在（version=${version}, rules=${rules})`);
}

function inspectTemplates(cwd) {
  const missing = REQUIRED_TEMPLATE_FILES.filter((file) => {
    return !runtimeRelativeCandidates("tasks", file)
      .some((candidate) => fs.existsSync(path.join(cwd, candidate)));
  });
  if (missing.length > 0) {
    return warn("runtime/tasks", `缺少模板: ${missing.join(", ")}`);
  }

  return ok("runtime/tasks", "bug / feature / explore 模板已就绪");
}

function detectRuntimeMode(cwd) {
  if (hasRuntimeSetup(cwd) || fs.existsSync(path.join(cwd, ".claude", "settings.json"))) {
    return "full";
  }
  return "protocol-only";
}

function inspectCodexHooks(cwd, hasCodexHost) {
  if (!hasCodexHost) {
    return skip(".codex/hooks", "当前项目未检测到 Codex 宿主");
  }

  const configPath = path.join(cwd, ".codex", "config.toml");
  const hooksPath = path.join(cwd, ".codex", "hooks.json");

  if (!fs.existsSync(configPath) && !fs.existsSync(hooksPath)) {
    return warn(".codex/hooks", "未发现 .codex/config.toml 和 hooks.json");
  }

  if (!fs.existsSync(configPath)) {
    return warn(".codex/hooks", "缺少 .codex/config.toml，trusted project 下不会默认启用 codex_hooks");
  }

  if (!fs.existsSync(hooksPath)) {
    return warn(".codex/hooks", "缺少 .codex/hooks.json");
  }

  const configContent = fs.readFileSync(configPath, "utf8");
  const hooksEnabled = /\bcodex_hooks\s*=\s*true\b/.test(configContent);
  if (!hooksEnabled) {
    return warn(".codex/hooks", ".codex/config.toml 存在，但未开启 features.codex_hooks = true");
  }

  let parsedHooks;
  try {
    parsedHooks = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
  } catch {
    return warn(".codex/hooks", "hooks.json 存在，但 JSON 解析失败");
  }

  const checks = [
    hasCodexHookCommand(parsedHooks, "UserPromptSubmit", "user_prompt_submit_intake.js"),
    hasCodexHookCommand(parsedHooks, "SessionStart", "session_start_restore.js"),
    hasCodexHookCommand(parsedHooks, "PostToolUse", "post_tool_use_record_evidence.js")
  ];

  if (checks.some((item) => item === false)) {
    return warn(".codex/hooks", "hooks.json 存在，但 agent-harness Codex hooks 不完整");
  }

  return ok(".codex/hooks", "Codex hooks 已配置；trusted project 默认启用，untrusted 请显式使用 codex --enable codex_hooks");
}

function inspectClaudeHooks(cwd, runtimeMode, hasClaudeHost) {
  const settingsPath = path.join(cwd, ".claude", "settings.json");

  if (!hasClaudeHost) {
    return skip(".claude/settings.json", "当前项目未检测到 Claude Code 宿主");
  }

  if (!fs.existsSync(settingsPath)) {
    if (runtimeMode === "protocol-only") {
      return skip(".claude/settings.json", "protocol-only 模式，无需 hooks");
    }

    return warn(".claude/settings.json", "未发现 Claude Code hooks");
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return warn(".claude/settings.json", "文件存在，但 JSON 解析失败");
  }

  const commands = Object.values(parsed.hooks ?? {})
    .flatMap((entries) => entries ?? [])
    .flatMap((entry) => entry.hooks ?? [])
    .map((hook) => hook.command)
    .filter(Boolean);

  const hasPreTool = commands.some((command) => command.includes("agent-harness gate before-tool"));
  const hasPostTool = commands.some((command) => command.includes("agent-harness state update"));

  if (hasPreTool && hasPostTool) {
    return ok(".claude/settings.json", "Claude Code hooks 已配置");
  }

  return warn(".claude/settings.json", "hooks 存在，但 agent-harness 命令不完整");
}

function hasCodexHookCommand(parsedHooks, eventName, commandFragment) {
  const eventEntries = parsedHooks?.hooks?.[eventName];
  if (!Array.isArray(eventEntries)) {
    return false;
  }

  return eventEntries
    .flatMap((entry) => entry?.hooks ?? [])
    .some((hook) => typeof hook?.command === "string" && hook.command.includes(commandFragment));
}

function inspectRuntimeDirectories(cwd, runtimeMode) {
  if (runtimeMode === "protocol-only") {
    return skip("runtime", "protocol-only 模式，无需运行时目录");
  }

  const runtimeDir = resolveRuntimeDirName(cwd);
  const required = [
    path.posix.join(runtimeDir, "README.md"),
    path.posix.join(runtimeDir, "state", "tasks"),
    path.posix.join(runtimeDir, "audit"),
    path.posix.join(runtimeDir, "reports")
  ];
  const missing = required.filter((file) => !fs.existsSync(path.join(cwd, file)));

  if (missing.length > 0) {
    return warn("runtime", `缺少: ${missing.join(", ")}`);
  }

  return ok("runtime", `运行时目录已就绪（${runtimeDir}/）`);
}

function inspectGitignore(cwd, runtimeMode) {
  const targetPath = path.join(cwd, ".gitignore");
  if (!fs.existsSync(targetPath)) {
    if (runtimeMode === "protocol-only") {
      return skip(".gitignore", "protocol-only 模式，无需 runtime ignore");
    }

    return warn(".gitignore", "缺少 .gitignore");
  }

  const content = fs.readFileSync(targetPath, "utf8");
  const required = [
    `${runtimeRelativePathForCwd(cwd, "state")}/`,
    `${runtimeRelativePathForCwd(cwd, "audit")}/`
  ];
  const missing = required.filter((entry) => !content.includes(entry));

  if (missing.length > 0) {
    if (runtimeMode === "protocol-only") {
      return skip(".gitignore", "protocol-only 模式，无需 runtime ignore");
    }

    return warn(".gitignore", `缺少忽略项: ${missing.join(", ")}`);
  }

  return ok(".gitignore", "runtime ignore 已配置");
}

function detectHosts(cwd) {
  const hosts = [];
  if (fs.existsSync(path.join(cwd, "CLAUDE.md")) || fs.existsSync(path.join(cwd, ".claude"))) {
    hosts.push("claude-code");
  }
  if (fs.existsSync(path.join(cwd, "AGENTS.md"))) {
    hosts.push("codex");
  }
  if (fs.existsSync(path.join(cwd, "GEMINI.md"))) {
    hosts.push("gemini-cli");
  }
  return hosts;
}

function pushCheck(checks, check) {
  checks.push(check);
}

function printStatus(projectName, checks, warnings) {
  console.log(`agent-harness status — ${projectName}`);
  console.log("");
  console.log("接入检查：");
  for (const check of checks) {
    console.log(`  ${symbol(check.severity)} ${check.name.padEnd(22, " ")} ${check.message}`);
  }

  if (warnings.length > 0) {
    console.log("");
    console.log("提示：");
    for (const item of warnings) {
      console.log(`  - ${item}`);
    }
  }
}

function symbol(severity) {
  if (severity === "ok") {
    return "[✓]";
  }
  if (severity === "warn") {
    return "[!]";
  }
  if (severity === "fail") {
    return "[x]";
  }
  return "[-]";
}

function maxExitCode(current, severity) {
  if (severity === "fail") {
    return 2;
  }
  if (severity === "warn") {
    return Math.max(current, 1);
  }
  return current;
}

function ok(name, message) {
  return { name, message, severity: "ok" };
}

function warn(name, message) {
  return { name, message, severity: "warn" };
}

function fail(name, message) {
  return { name, message, severity: "fail" };
}

function skip(name, message) {
  return { name, message, severity: "skip" };
}
