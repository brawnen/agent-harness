import { runCodexHook } from "../../packages/cli/src/lib/codex-hooks.js";
import { readHookPayload, writeContinue } from "./shared/codex-hook-io.js";

try {
  const payload = readHookPayload();
  process.stdout.write(`${JSON.stringify(runCodexHook("session-start", payload), null, 2)}\n`);
} catch (error) {
  writeContinue("SessionStart", `Codex SessionStart hook 执行失败：${error.message}`);
}
