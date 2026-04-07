import {
  handleAfterTool,
  handleBeforeTool,
  handleCompletionGate,
  handlePromptSubmit,
  handleSessionStart
} from "./hook-core.js";
import {
  buildGeminiHookOutput,
  resolveGeminiCompletionMessage,
  resolveGeminiToolCommand,
  resolveGeminiToolExitCode,
  resolveGeminiToolName,
  resolveGeminiToolOutput,
  resolveGeminiToolPath
} from "./hook-io/gemini.js";
import { resolvePayloadCwd, resolvePayloadPrompt } from "./hook-io/shared.js";

const MANUAL_FALLBACK_COMMANDS = [
  "node packages/cli/bin/agent-harness.js state active",
  "node packages/cli/bin/agent-harness.js task intake \"任务描述\"",
  "node packages/cli/bin/agent-harness.js task suspend-active --reason \"切换任务\""
];

export function runGeminiHook(event, payload) {
  const cwd = resolvePayloadCwd(payload);

  if (event === "session-start") {
    return buildGeminiHookOutput(handleSessionStart({
      cwd,
      fallbackCommands: [
        "node packages/cli/bin/agent-harness.js state active",
        "node packages/cli/bin/agent-harness.js task intake \"任务描述\""
      ],
      hostDisplayName: "Gemini CLI",
      source: payload?.source ?? ""
    }));
  }

  if (event === "before-agent") {
    return buildGeminiHookOutput(handlePromptSubmit({
      cwd,
      fallbackCommands: MANUAL_FALLBACK_COMMANDS,
      hostDisplayName: "Gemini CLI",
      prompt: resolvePayloadPrompt(payload)
    }));
  }

  if (event === "before-tool") {
    return buildGeminiHookOutput(handleBeforeTool({
      command: resolveGeminiToolCommand(payload),
      cwd,
      filePath: resolveGeminiToolPath(payload),
      toolName: resolveGeminiToolName(payload)
    }));
  }

  if (event === "after-tool") {
    return buildGeminiHookOutput(handleAfterTool({
      command: resolveGeminiToolCommand(payload),
      cwd,
      exitCode: resolveGeminiToolExitCode(payload),
      output: resolveGeminiToolOutput(payload),
      toolName: resolveGeminiToolName(payload)
    }));
  }

  if (event === "after-agent") {
    return buildGeminiHookOutput(handleCompletionGate({
      cwd,
      lastAssistantMessage: resolveGeminiCompletionMessage(payload)
    }));
  }

  throw new Error(`未知 Gemini hook 事件: ${event}`);
}
