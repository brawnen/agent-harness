import { appendTaskEvidence, getActiveTask, resolveActiveTaskId } from "../../packages/cli/src/lib/state-store.js";
import { readHookPayload, resolvePayloadCwd, writeContinue } from "./shared/codex-hook-io.js";

const TEST_COMMAND_PATTERNS = [
  /\bnpm test\b/i,
  /\bpnpm test\b/i,
  /\byarn test\b/i,
  /\bjest\b/i,
  /\bvitest\b/i,
  /\bpytest\b/i,
  /\bgo test\b/i,
  /\bcargo test\b/i,
  /\bmvn test\b/i,
  /\bgradlew test\b/i,
  /\bunittest\b/i
];

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const activeTaskId = resolveActiveTaskId(cwd);
  if (!activeTaskId) {
    writeContinue("PostToolUse");
    process.exit(0);
  }

  const activeTask = getActiveTask(cwd);
  if (!activeTask || ["done", "failed", "suspended"].includes(activeTask.current_state)) {
    writeContinue("PostToolUse");
    process.exit(0);
  }

  const toolName = resolveToolName(payload);
  if (toolName && toolName !== "Bash") {
    writeContinue("PostToolUse");
    process.exit(0);
  }

  const command = resolveCommand(payload);
  const exitCode = resolveExitCode(payload);
  const output = resolveOutput(payload);
  const evidenceType = inferEvidenceType(command, activeTask);

  appendTaskEvidence(cwd, activeTaskId, {
    type: evidenceType,
    content: buildEvidenceContent(command, exitCode, output),
    exit_code: exitCode,
    passed: typeof exitCode === "number" ? exitCode === 0 : undefined,
    timestamp: new Date().toISOString()
  });

  writeContinue("PostToolUse");
} catch (error) {
  writeContinue("PostToolUse", `自动记录 Bash evidence 失败，已降级继续：${error.message}`);
}

function resolveToolName(payload) {
  return firstString([
    payload?.tool_name,
    payload?.toolName,
    payload?.tool?.name,
    payload?.toolUse?.name,
    payload?.name
  ]);
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

function inferEvidenceType(command, activeTask) {
  const normalizedCommand = String(command ?? "");
  if (activeTask?.current_phase === "verify" || TEST_COMMAND_PATTERNS.some((pattern) => pattern.test(normalizedCommand))) {
    return "test_result";
  }
  return "command_result";
}

function buildEvidenceContent(command, exitCode, output) {
  const lines = [`Command: ${command}`];
  if (typeof exitCode === "number") {
    lines.push(`Exit code: ${exitCode}`);
  }

  const normalizedOutput = String(output ?? "").trim();
  if (normalizedOutput) {
    const compact = normalizedOutput.length > 400
      ? `${normalizedOutput.slice(0, 400)}...`
      : normalizedOutput;
    lines.push(`Output: ${compact}`);
  }

  return lines.join("\n");
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
