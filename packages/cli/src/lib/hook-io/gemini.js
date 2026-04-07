import { firstDefined, firstString } from "./shared.js";

export function buildGeminiHookOutput(decision) {
  if (decision.status === "block") {
    return {
      decision: "deny",
      reason: decision.reason
    };
  }

  if (!decision.additionalContext) {
    return {};
  }

  return {
    hookSpecificOutput: {
      additionalContext: decision.additionalContext
    }
  };
}

export function resolveGeminiCompletionMessage(payload) {
  return firstString([
    payload?.prompt_response,
    payload?.response,
    payload?.last_assistant_message
  ]) ?? "";
}

export function resolveGeminiToolName(payload) {
  return firstString([
    payload?.tool_name,
    payload?.toolName,
    payload?.tool?.name,
    payload?.toolUse?.name,
    payload?.name
  ]);
}

export function resolveGeminiToolCommand(payload) {
  return firstString([
    payload?.tool_input?.command,
    payload?.toolInput?.command,
    payload?.input?.command,
    payload?.arguments?.command,
    payload?.tool_use?.input?.command,
    payload?.toolUse?.input?.command,
    payload?.command
  ]) ?? "";
}

export function resolveGeminiToolPath(payload) {
  return firstString([
    payload?.tool_input?.file_path,
    payload?.tool_input?.path,
    payload?.toolInput?.file_path,
    payload?.toolInput?.path,
    payload?.input?.file_path,
    payload?.input?.path,
    payload?.arguments?.file_path,
    payload?.arguments?.path,
    payload?.tool_use?.input?.file_path,
    payload?.tool_use?.input?.path,
    payload?.toolUse?.input?.file_path,
    payload?.toolUse?.input?.path
  ]);
}

export function resolveGeminiToolExitCode(payload) {
  const value = firstDefined([
    payload?.exit_code,
    payload?.exitCode,
    payload?.result?.exit_code,
    payload?.result?.exitCode,
    payload?.tool_response?.exit_code,
    payload?.tool_response?.exitCode,
    payload?.toolResponse?.exit_code,
    payload?.toolResponse?.exitCode,
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

export function resolveGeminiToolOutput(payload) {
  const directOutput = firstString([
    payload?.tool_response?.output,
    payload?.tool_response?.stdout,
    payload?.toolResponse?.output,
    payload?.toolResponse?.stdout,
    payload?.stdout,
    payload?.stderr,
    payload?.result?.output,
    payload?.result?.stdout,
    payload?.output
  ]);

  if (directOutput) {
    return directOutput;
  }

  const displayOutput = firstString([
    payload?.tool_response?.returnDisplay,
    payload?.toolResponse?.returnDisplay
  ]);

  if (displayOutput) {
    return displayOutput;
  }

  const responsePayload = firstDefined([
    payload?.tool_response,
    payload?.toolResponse
  ]);

  if (!responsePayload || typeof responsePayload === "string") {
    return responsePayload ?? "";
  }

  return JSON.stringify(responsePayload);
}
