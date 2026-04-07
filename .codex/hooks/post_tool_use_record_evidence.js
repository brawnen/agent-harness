import { handleAfterTool } from "../../packages/cli/src/lib/hook-core.js";
import { buildCodexHookOutput } from "../../packages/cli/src/lib/hook-io/codex.js";
import { readHookPayload, resolvePayloadCwd } from "../../packages/cli/src/lib/hook-io/shared.js";

try {
  const payload = readHookPayload();
  const result = handleAfterTool({
    command: resolveCommand(payload),
    cwd: resolvePayloadCwd(payload),
    exitCode: resolveExitCode(payload),
    output: resolveOutput(payload),
    toolName: "Bash"
  });
  process.stdout.write(`${JSON.stringify(buildCodexHookOutput("PostToolUse", result), null, 2)}\n`);
} catch {
  process.stdout.write("{}\n");
}

function resolveCommand(payload) {
  return firstString([
    payload?.tool_input?.command,
    payload?.toolInput?.command,
    payload?.input?.command,
    payload?.arguments?.command,
    payload?.tool_use?.input?.command,
    payload?.toolUse?.input?.command,
    payload?.command
  ]) ?? "<unknown command>";
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

function resolveOutput(payload) {
  return firstString([
    payload?.tool_response,
    payload?.output,
    payload?.stdout,
    payload?.stderr,
    payload?.result?.output,
    payload?.result?.stdout,
    payload?.result?.stderr,
    payload?.tool_output?.output,
    payload?.toolOutput?.output
  ]) ?? "";
}

function firstString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function firstDefined(values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return null;
}
