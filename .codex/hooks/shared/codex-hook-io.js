import fs from "node:fs";

export function readHookPayload() {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Codex hook stdin 不是合法 JSON");
  }
}

export function writeContinue(hookEventName, additionalContext = "") {
  const result = additionalContext
    ? {
        hookSpecificOutput: {
          hookEventName,
          additionalContext
        }
      }
    : {};

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export function writeBlock(reason) {
  process.stdout.write(`${JSON.stringify({
    decision: "block",
    reason
  }, null, 2)}\n`);
}

export function buildManualFallbackContext(reason, options = {}) {
  const message = typeof reason === "string" && reason.trim().length > 0
    ? reason.trim()
    : "Codex hook 执行失败";
  const commands = Array.isArray(options.commands) ? options.commands.filter(Boolean) : [];
  const fallbackCommands = commands.length > 0
    ? commands
    : [
        "node packages/cli/bin/agent-harness.js state active",
        "node packages/cli/bin/agent-harness.js task intake \"任务描述\"",
        "node packages/cli/bin/agent-harness.js task suspend-active --reason \"切换任务\""
      ];

  return `${message} 已降级到手动模式。可用 fallback：${fallbackCommands.join("；")}`;
}

export function resolvePayloadPrompt(payload) {
  if (typeof payload?.prompt === "string") {
    return payload.prompt;
  }
  if (typeof payload?.input === "string") {
    return payload.input;
  }
  return "";
}

export function resolvePayloadCwd(payload) {
  return payload?.cwd || process.cwd();
}
