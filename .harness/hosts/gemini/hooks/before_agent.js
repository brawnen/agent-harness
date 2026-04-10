import { readHookPayload, resolvePayloadCwd, resolvePayloadPrompt, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

const FALLBACK_COMMANDS = [
  "node packages/cli/bin/agent-harness.js state active",
  "node packages/cli/bin/agent-harness.js task intake \"任务描述\"",
  "node packages/cli/bin/agent-harness.js task suspend-active --reason \"切换任务\""
];

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handlePromptSubmit, buildGeminiHookOutput } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildGeminiHookOutput(handlePromptSubmit({
    cwd,
    fallbackCommands: FALLBACK_COMMANDS,
    hostDisplayName: "Gemini CLI",
    prompt: resolvePayloadPrompt(payload)
  })));
} catch {
  writeHookOutput({});
}
