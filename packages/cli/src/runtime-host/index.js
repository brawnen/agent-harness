import { getActiveTask, resolveActiveTaskId, updateTaskState } from "../lib/state-store.js";

export {
  blockDecision,
  buildManualFallbackContext,
  continueDecision,
  handleAfterTool,
  handleBeforeTool,
  handleCompletionGate,
  handlePromptSubmit,
  handleSessionStart,
  normalizeHarnessToolName
} from "../lib/hook-core.js";
export { buildClaudeHookOutput, resolveClaudeCompletionMessage } from "../lib/hook-io/claude.js";
export { buildCodexHookOutput, resolveCodexCompletionMessage } from "../lib/hook-io/codex.js";
export {
  buildGeminiHookOutput,
  resolveGeminiCompletionMessage,
  resolveGeminiToolCommand,
  resolveGeminiToolExitCode,
  resolveGeminiToolName,
  resolveGeminiToolOutput,
  resolveGeminiToolPath
} from "../lib/hook-io/gemini.js";

export function appendMinimalToolEvidence({
  content = null,
  cwd,
  exitCode = 0,
  toolName = null,
  type = "command_result"
}) {
  const taskId = resolveActiveTaskId(cwd);
  const activeTask = getActiveTask(cwd);

  if (!taskId || !activeTask || ["done", "failed", "suspended"].includes(activeTask.current_state)) {
    return false;
  }

  const safeToolName = typeof toolName === "string" && toolName.trim().length > 0
    ? toolName.trim()
    : "<unknown tool>";
  const evidenceContent = typeof content === "string" && content.trim().length > 0
    ? content.trim()
    : `Tool: ${safeToolName}`;

  updateTaskState(cwd, taskId, {
    evidence: [{
      content: evidenceContent,
      exit_code: typeof exitCode === "number" ? exitCode : 0,
      timestamp: new Date().toISOString(),
      type
    }]
  });

  return true;
}
