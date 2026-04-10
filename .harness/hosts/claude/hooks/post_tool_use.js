import {
  firstDefined,
  firstString,
  readHookPayload,
  resolvePayloadCwd,
  writeHookOutput
} from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { appendMinimalToolEvidence } = await importRuntimeModule("runtime-host", cwd);
  appendMinimalToolEvidence({
    cwd,
    exitCode: resolveExitCode(payload) ?? 0,
    toolName: firstString([
      payload?.tool_name,
      payload?.toolName,
      payload?.tool?.name,
      payload?.toolUse?.name,
      payload?.name
    ])
  });

  writeHookOutput({});
} catch {
  writeHookOutput({});
}

function resolveExitCode(payload) {
  const value = firstDefined([
    payload?.exit_code,
    payload?.exitCode,
    payload?.result?.exit_code,
    payload?.result?.exitCode,
    payload?.tool_output?.exit_code,
    payload?.toolOutput?.exitCode,
    payload?.status
  ]);

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
