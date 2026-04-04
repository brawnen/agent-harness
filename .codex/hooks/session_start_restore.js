import { getActiveTask } from "../../packages/cli/src/lib/state-store.js";
import { buildCurrentTaskContext } from "../../packages/cli/src/lib/task-core.js";
import { buildManualFallbackContext, readHookPayload, resolvePayloadCwd, writeContinue } from "./shared/codex-hook-io.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const activeTask = getActiveTask(cwd);

  if (!activeTask) {
    writeContinue("SessionStart");
    process.exit(0);
  }

  const source = payload?.source ? `来源：${payload.source}。` : "";
  writeContinue("SessionStart", `${source}${buildCurrentTaskContext(activeTask)}`);
} catch (error) {
  writeContinue("SessionStart", buildManualFallbackContext(`恢复 active task 失败：${error.message}`, {
    commands: [
      "node packages/cli/bin/agent-harness.js state active",
      "node packages/cli/bin/agent-harness.js task intake \"任务描述\""
    ]
  }));
}
