import { readHookPayload, resolvePayloadCwd, resolvePayloadPrompt, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

const FALLBACK_COMMANDS = [
  "npx @brawnen/agent-harness-cli state active",
  "npx @brawnen/agent-harness-cli task intake \"任务描述\"",
  "npx @brawnen/agent-harness-cli task suspend-active --reason \"切换任务\""
];

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handlePromptSubmit, buildClaudeHookOutput } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildClaudeHookOutput("UserPromptSubmit", handlePromptSubmit({
    cwd,
    fallbackCommands: FALLBACK_COMMANDS,
    hostDisplayName: "Claude Code",
    prompt: resolvePayloadPrompt(payload)
  })));
} catch (error) {
  const { buildClaudeHookOutput } = await importRuntimeModule("runtime-host");
  writeHookOutput(buildClaudeHookOutput("UserPromptSubmit", {
    additionalContext: `Claude Code UserPromptSubmit hook 执行失败：${error.message}`,
    status: "continue"
  }));
}
