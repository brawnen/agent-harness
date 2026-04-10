import { readHookPayload, resolvePayloadCwd, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

const FALLBACK_COMMANDS = [
  "node packages/cli/bin/agent-harness.js state active",
  "node packages/cli/bin/agent-harness.js task intake \"任务描述\""
];

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handleSessionStart, buildGeminiHookOutput } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildGeminiHookOutput(handleSessionStart({
    cwd,
    fallbackCommands: FALLBACK_COMMANDS,
    hostDisplayName: "Gemini CLI",
    source: payload?.source ?? ""
  })));
} catch {
  writeHookOutput({});
}
