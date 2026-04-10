import { invokeAgentHarnessCodexHook, readHookPayload, writeContinue } from "./shared/codex-hook-io.js";

try {
  const payload = readHookPayload();
  process.stdout.write(`${JSON.stringify(await invokeAgentHarnessCodexHook("user-prompt-submit", payload), null, 2)}\n`);
} catch (error) {
  await writeContinue("UserPromptSubmit", `Codex UserPromptSubmit hook 执行失败：${error.message}`);
}
