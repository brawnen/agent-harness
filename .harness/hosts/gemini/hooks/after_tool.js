import { readHookPayload, resolvePayloadCwd, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const {
    handleAfterTool,
    buildGeminiHookOutput,
    resolveGeminiToolCommand,
    resolveGeminiToolExitCode,
    resolveGeminiToolName,
    resolveGeminiToolOutput
  } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildGeminiHookOutput(handleAfterTool({
    command: resolveGeminiToolCommand(payload),
    cwd,
    exitCode: resolveGeminiToolExitCode(payload),
    output: resolveGeminiToolOutput(payload),
    toolName: resolveGeminiToolName(payload)
  })));
} catch {
  writeHookOutput({});
}
