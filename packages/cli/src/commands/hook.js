import {
  handleClaudeSessionStart,
  handleClaudeStop,
  handleClaudeUserPromptSubmit,
  readHookPayload
} from "../lib/claude-hooks.js";

export function runHook(argv) {
  const [host, event] = argv;

  if (!host || !event) {
    console.error("用法: hook claude <session-start|user-prompt-submit|stop>");
    return 1;
  }

  if (host !== "claude" && host !== "claude-code") {
    console.error(`未知 hook 宿主: ${host}`);
    return 1;
  }

  try {
    const payload = readHookPayload();
    const result = runClaudeHook(event, payload);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function runClaudeHook(event, payload) {
  if (event === "session-start") {
    return handleClaudeSessionStart(payload);
  }

  if (event === "user-prompt-submit") {
    return handleClaudeUserPromptSubmit(payload);
  }

  if (event === "stop") {
    return handleClaudeStop(payload);
  }

  throw new Error(`未知 Claude hook 事件: ${event}`);
}
