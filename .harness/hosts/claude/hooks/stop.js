import { readHookPayload, resolvePayloadCwd, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handleCompletionGate, buildClaudeHookOutput, resolveClaudeCompletionMessage } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildClaudeHookOutput("Stop", handleCompletionGate({
    cwd,
    lastAssistantMessage: resolveClaudeCompletionMessage(payload)
  })));
} catch {
  writeHookOutput({});
}
