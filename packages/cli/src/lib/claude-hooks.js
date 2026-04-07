import {
  handleCompletionGate,
  handlePromptSubmit,
  handleSessionStart
} from "./hook-core.js";
import { buildClaudeHookOutput, resolveClaudeCompletionMessage } from "./hook-io/claude.js";
import { readHookPayload, resolvePayloadCwd, resolvePayloadPrompt } from "./hook-io/shared.js";

const MANUAL_FALLBACK_COMMANDS = [
  "npx @brawnen/agent-harness-cli state active",
  "npx @brawnen/agent-harness-cli task intake \"任务描述\"",
  "npx @brawnen/agent-harness-cli task suspend-active --reason \"切换任务\""
];

export { readHookPayload };

export function runClaudeHook(event, payload) {
  const cwd = resolvePayloadCwd(payload);

  if (event === "session-start") {
    return buildClaudeHookOutput("SessionStart", handleSessionStart({
      cwd,
      fallbackCommands: [
        "npx @brawnen/agent-harness-cli state active",
        "npx @brawnen/agent-harness-cli task intake \"任务描述\""
      ],
      hostDisplayName: "Claude Code",
      source: payload?.source ?? ""
    }));
  }

  if (event === "user-prompt-submit") {
    return buildClaudeHookOutput("UserPromptSubmit", handlePromptSubmit({
      cwd,
      fallbackCommands: MANUAL_FALLBACK_COMMANDS,
      hostDisplayName: "Claude Code",
      prompt: resolvePayloadPrompt(payload)
    }));
  }

  if (event === "stop") {
    return buildClaudeHookOutput("Stop", handleCompletionGate({
      cwd,
      lastAssistantMessage: resolveClaudeCompletionMessage(payload)
    }));
  }

  throw new Error(`未知 Claude hook 事件: ${event}`);
}
