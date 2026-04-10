import { readHookPayload, resolvePayloadCwd, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

const FALLBACK_COMMANDS = [
  "npx @brawnen/agent-harness-cli state active",
  "npx @brawnen/agent-harness-cli task intake \"任务描述\""
];

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handleSessionStart, buildClaudeHookOutput } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildClaudeHookOutput("SessionStart", handleSessionStart({
    cwd,
    fallbackCommands: FALLBACK_COMMANDS,
    hostDisplayName: "Claude Code",
    source: payload?.source ?? ""
  })));
} catch (error) {
  const { buildClaudeHookOutput } = await importRuntimeModule("runtime-host");
  writeHookOutput(buildClaudeHookOutput("SessionStart", {
    additionalContext: `Claude Code SessionStart hook 执行失败：${error.message}`,
    status: "continue"
  }));
}
