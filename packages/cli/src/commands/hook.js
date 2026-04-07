import { runClaudeHook, readHookPayload } from "../lib/claude-hooks.js";
import { runCodexHook } from "../lib/codex-hooks.js";
import { runGeminiHook } from "../lib/gemini-hooks.js";

export function runHook(argv) {
  const [host, event] = argv;

  if (!host || !event) {
    console.error("用法: hook <claude|codex|gemini> <event>");
    return 1;
  }

  if (!["claude", "claude-code", "codex", "gemini", "gemini-cli"].includes(host)) {
    console.error(`未知 hook 宿主: ${host}`);
    return 1;
  }

  try {
    const payload = readHookPayload();
    const result = runHostHook(host, event, payload);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function runHostHook(host, event, payload) {
  if (host === "claude" || host === "claude-code") {
    return runClaudeHook(event, payload);
  }

  if (host === "codex") {
    return runCodexHook(event, payload);
  }

  if (host === "gemini" || host === "gemini-cli") {
    return runGeminiHook(event, payload);
  }

  throw new Error(`未知 hook 宿主: ${host}`);
}
