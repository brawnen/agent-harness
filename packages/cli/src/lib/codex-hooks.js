import {
  handleCompletionGate,
  handlePromptSubmit,
  handleSessionStart
} from "./hook-core.js";
import { buildCodexHookOutput, resolveCodexCompletionMessage } from "./hook-io/codex.js";
import { resolvePayloadCwd, resolvePayloadPrompt } from "./hook-io/shared.js";

const MANUAL_FALLBACK_COMMANDS = [
  "node packages/cli/bin/agent-harness.js state active",
  "node packages/cli/bin/agent-harness.js task intake \"任务描述\"",
  "node packages/cli/bin/agent-harness.js task suspend-active --reason \"切换任务\""
];

export function runCodexHook(event, payload) {
  if (event === "session-start") {
    const decision = handleSessionStart({
      cwd: resolvePayloadCwd(payload),
      fallbackCommands: [
        "node packages/cli/bin/agent-harness.js state active",
        "node packages/cli/bin/agent-harness.js task intake \"任务描述\""
      ],
      hostDisplayName: "Codex",
      source: payload?.source ?? ""
    });
    return buildCodexHookOutput("SessionStart", decision);
  }

  if (event === "user-prompt-submit") {
    const decision = handlePromptSubmit({
      cwd: resolvePayloadCwd(payload),
      fallbackCommands: MANUAL_FALLBACK_COMMANDS,
      hostDisplayName: "Codex",
      prompt: resolvePayloadPrompt(payload)
    });
    return buildCodexHookOutput("UserPromptSubmit", decision);
  }

  if (event === "stop") {
    const decision = handleCompletionGate({
      cwd: resolvePayloadCwd(payload),
      lastAssistantMessage: resolveCodexCompletionMessage(payload)
    });
    return buildCodexHookOutput("Stop", decision);
  }

  throw new Error(`未知 Codex hook 事件: ${event}`);
}
