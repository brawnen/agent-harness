import fs from "node:fs";
import path from "node:path";

const REQUIRED_TEMPLATE_FILES = [
  "harness/tasks/bug.md",
  "harness/tasks/explore.md",
  "harness/tasks/feature.md"
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
  const configPath = path.join(cwd, "harness.yaml");
  if (!fs.existsSync(configPath)) {
    return fail("harness.yaml", "缺失，项目尚未初始化");
  }

  const content = fs.readFileSync(configPath, "utf8");
  const schemaVersion = content.match(/^schema_version:\s+"?([^"\n]+)"?/m)?.[1] ?? "unknown";
  const mode = content.match(/^default_mode:\s+"?([^"\n]+)"?/m)?.[1] ?? "unknown";

  return ok("harness.yaml", `schema_version=${schemaVersion}, default_mode=${mode}`);
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
  const missing = REQUIRED_TEMPLATE_FILES.filter((file) => !fs.existsSync(path.join(cwd, file)));
  if (missing.length > 0) {
    return warn("harness/tasks", `缺少模板: ${missing.map((file) => path.basename(file)).join(", ")}`);
  }

  return ok("harness/tasks", "bug / feature / explore 模板已就绪");
}

function detectRuntimeMode(cwd) {
  const runtimeMarkers = [
    "harness/README.md",
    "harness/state",
    "harness/audit",
    "harness/reports",
    ".claude/settings.json"
  ];

  return runtimeMarkers.some((file) => fs.existsSync(path.join(cwd, file))) ? "full" : "protocol-only";
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

function inspectRuntimeDirectories(cwd, runtimeMode) {
  if (runtimeMode === "protocol-only") {
    return skip("harness/runtime", "protocol-only 模式，无需运行时目录");
  }

  const required = [
    "harness/README.md",
    "harness/state/tasks",
    "harness/audit",
    "harness/reports"
  ];
  const missing = required.filter((file) => !fs.existsSync(path.join(cwd, file)));

  if (missing.length > 0) {
    return warn("harness/runtime", `缺少: ${missing.join(", ")}`);
  }

  return ok("harness/runtime", "运行时目录已就绪");
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
  const required = ["harness/state/", "harness/audit/"];
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
