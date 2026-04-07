import { handleBeforeTool } from "../../packages/cli/src/lib/hook-core.js";
import { buildCodexHookOutput } from "../../packages/cli/src/lib/hook-io/codex.js";
import { readHookPayload, resolvePayloadCwd } from "../../packages/cli/src/lib/hook-io/shared.js";

try {
  const payload = readHookPayload();
  const result = handleBeforeTool({
    command: resolveCommand(payload),
    cwd: resolvePayloadCwd(payload),
    filePath: resolveFilePath(payload),
    taskId: resolveTaskId(payload),
    toolName: resolveToolName(payload)
  });
  process.stdout.write(`${JSON.stringify(buildCodexHookOutput("PreToolUse", result), null, 2)}\n`);
} catch {
  process.stdout.write("{}\n");
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

function resolveFilePath(payload) {
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

function resolveTaskId(payload) {
  return firstString([
    payload?.task_id,
    payload?.taskId,
    payload?.context?.task_id,
    payload?.context?.taskId
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
  ]);
}

function firstString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}
