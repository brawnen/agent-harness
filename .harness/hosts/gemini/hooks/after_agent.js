import { readHookPayload, resolvePayloadCwd, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handleCompletionGate, buildGeminiHookOutput, resolveGeminiCompletionMessage } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildGeminiHookOutput(handleCompletionGate({
    cwd,
    lastAssistantMessage: resolveGeminiCompletionMessage(payload)
  })));
} catch {
  writeHookOutput({});
}
