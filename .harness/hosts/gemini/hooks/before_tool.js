import { readHookPayload, resolvePayloadCwd, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const {
    handleBeforeTool,
    buildGeminiHookOutput,
    resolveGeminiToolCommand,
    resolveGeminiToolName,
    resolveGeminiToolPath
  } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildGeminiHookOutput(handleBeforeTool({
    command: resolveGeminiToolCommand(payload),
    cwd,
    filePath: resolveGeminiToolPath(payload),
    toolName: resolveGeminiToolName(payload)
  })));
} catch {
  writeHookOutput({});
}
