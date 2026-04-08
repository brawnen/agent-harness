import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function readHookPayload() {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("hook stdin 不是合法 JSON");
  }
}

export function resolvePayloadCwd(payload) {
  if (typeof payload?.cwd === "string" && payload.cwd.trim()) {
    return payload.cwd.trim();
  }

  return process.cwd();
}

export function resolvePayloadPrompt(payload) {
  if (typeof payload?.prompt === "string" && payload.prompt.trim()) {
    return payload.prompt.trim();
  }

  if (typeof payload?.user_prompt === "string" && payload.user_prompt.trim()) {
    return payload.user_prompt.trim();
  }

  return "";
}

export function buildManualFallbackContext(reason, { commands = [], hostDisplayName = "Codex" } = {}) {
  const safeReason = typeof reason === "string" && reason.trim()
    ? reason.trim()
    : `${hostDisplayName} hook 执行失败`;
  const fallbackCommands = Array.isArray(commands)
    ? commands.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];

  if (fallbackCommands.length === 0) {
    return `${safeReason} 已降级继续。`;
  }

  return `${safeReason} 已降级到手动模式。可用 fallback：${fallbackCommands.join("；")}`;
}

export function writeContinue(hookEventName, additionalContext = "") {
  const text = typeof additionalContext === "string" ? additionalContext.trim() : "";
  process.stdout.write(`${JSON.stringify(
    buildCodexHookOutput(hookEventName, {
      additionalContext: text,
      status: "continue"
    }),
    null,
    2
  )}\n`);
}

export function writeBlock(reason) {
  process.stdout.write(`${JSON.stringify(
    buildCodexHookOutput("Block", { reason, status: "block" }),
    null,
    2
  )}\n`);
}

export function invokeAgentHarnessCodexHook(event, payload) {
  const cwd = resolvePayloadCwd(payload);
  const repoRoot = resolveRepoRoot(cwd);
  const cliBin = resolveAgentHarnessCliBin(repoRoot);
  const result = spawnSync(
    process.execPath,
    [cliBin, "hook", "codex", event],
    {
      cwd: repoRoot,
      encoding: "utf8",
      input: `${JSON.stringify(payload ?? {})}\n`
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const detail = String(result.stderr ?? result.stdout ?? "").trim();
    throw new Error(detail || `agent-harness hook 命令失败（exit=${result.status}）`);
  }

  const stdout = String(result.stdout ?? "").trim();
  if (!stdout) {
    return {};
  }

  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error("agent-harness hook 输出不是合法 JSON");
  }
}

function buildCodexHookOutput(eventName, decision) {
  if (decision.status === "block") {
    return {
      decision: "block",
      reason: decision.reason
    };
  }

  if (!decision.additionalContext) {
    return {};
  }

  return {
    hookSpecificOutput: {
      additionalContext: decision.additionalContext,
      hookEventName: eventName
    }
  };
}

function resolveRepoRoot(cwd) {
  const resolvedCwd = path.resolve(cwd);
  const result = spawnSync("git", ["-C", resolvedCwd, "rev-parse", "--show-toplevel"], {
    encoding: "utf8"
  });

  if (!result.error && result.status === 0) {
    const root = String(result.stdout ?? "").trim();
    if (root) {
      return root;
    }
  }

  return resolvedCwd;
}

function resolveAgentHarnessCliBin(repoRoot) {
  const candidates = [
    path.join(repoRoot, "packages", "cli", "bin", "agent-harness.js"),
    path.join(repoRoot, "node_modules", "@brawnen", "agent-harness-cli", "bin", "agent-harness.js")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    return require.resolve("@brawnen/agent-harness-cli/bin/agent-harness.js", {
      paths: [repoRoot]
    });
  } catch {
    throw new Error(
      "无法定位 agent-harness CLI。请确认仓库内存在 packages/cli/bin/agent-harness.js，或已安装 @brawnen/agent-harness-cli。"
    );
  }
}
