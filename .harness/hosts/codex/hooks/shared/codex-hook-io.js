import fs from "node:fs";
import { importRuntimeModule } from "../../../shared/runtime-loader.js";

const SESSION_START_FALLBACK_COMMANDS = [
  "node packages/cli/bin/agent-harness.js state active",
  "node packages/cli/bin/agent-harness.js task intake \"任务描述\""
];

const MANUAL_FALLBACK_COMMANDS = [
  ...SESSION_START_FALLBACK_COMMANDS,
  "node packages/cli/bin/agent-harness.js task suspend-active --reason \"切换任务\""
];

export function readHookPayload() {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("hook stdin 不是合法 JSON");
  }
}

export function resolvePayloadCwd(payload) {
  if (typeof payload?.cwd === "string" && payload.cwd.trim()) {
    return payload.cwd.trim();
  }

  return process.cwd();
}

export function resolvePayloadPrompt(payload) {
  if (typeof payload?.prompt === "string" && payload.prompt.trim()) {
    return payload.prompt.trim();
  }

  if (typeof payload?.user_prompt === "string" && payload.user_prompt.trim()) {
    return payload.user_prompt.trim();
  }

  return "";
}

export function buildManualFallbackContext(reason, { commands = [], hostDisplayName = "Codex" } = {}) {
  const safeReason = typeof reason === "string" && reason.trim()
    ? reason.trim()
    : `${hostDisplayName} hook 执行失败`;
  const fallbackCommands = Array.isArray(commands)
    ? commands.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];

  if (fallbackCommands.length === 0) {
    return `${safeReason}，已降级继续。`;
  }

  return `${safeReason}，已降级。手动命令：${fallbackCommands.join("；")}`;
}

export async function writeContinue(hookEventName, additionalContext = "") {
  const { buildCodexHookOutput } = await importRuntimeModule("runtime-host");
  const text = typeof additionalContext === "string" ? additionalContext.trim() : "";
  process.stdout.write(`${JSON.stringify(
    buildCodexHookOutput(hookEventName, {
      additionalContext: text,
      status: "continue"
    }),
    null,
    2
  )}\n`);
}

export async function writeBlock(reason) {
  const { buildCodexHookOutput } = await importRuntimeModule("runtime-host");
  process.stdout.write(`${JSON.stringify(
    buildCodexHookOutput("Block", { reason, status: "block" }),
    null,
    2
  )}\n`);
}

export async function invokeAgentHarnessCodexHook(event, payload) {
  try {
    const cwd = resolvePayloadCwd(payload);
    const { handlePromptSubmit, handleSessionStart, buildCodexHookOutput } = await importRuntimeModule("runtime-host", cwd);

    if (event === "session-start") {
      return buildCodexHookOutput("SessionStart", handleSessionStart({
        cwd,
        fallbackCommands: SESSION_START_FALLBACK_COMMANDS,
        hostDisplayName: "Codex",
        source: payload?.source ?? ""
      }));
    }

    if (event === "user-prompt-submit") {
      return buildCodexHookOutput("UserPromptSubmit", handlePromptSubmit({
        cwd,
        fallbackCommands: MANUAL_FALLBACK_COMMANDS,
        hostDisplayName: "Codex",
        prompt: resolvePayloadPrompt(payload)
      }));
    }

    throw new Error(`未知 Codex hook 事件: ${event}`);
  } catch (error) {
    const hookEventName = event === "session-start" ? "SessionStart" : "UserPromptSubmit";
    const fallbackCommands = event === "session-start" ? SESSION_START_FALLBACK_COMMANDS : MANUAL_FALLBACK_COMMANDS;
    const { buildCodexHookOutput } = await importRuntimeModule("runtime-host", resolvePayloadCwd(payload));
    return buildCodexHookOutput(hookEventName, {
      additionalContext: buildManualFallbackContext(
        `Codex ${hookEventName} hook 执行失败：${error.message}`,
        { commands: fallbackCommands, hostDisplayName: "Codex" }
      ),
      status: "continue"
    });
  }
}
