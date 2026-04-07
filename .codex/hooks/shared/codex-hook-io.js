import { buildManualFallbackContext, continueDecision } from "../../../packages/cli/src/lib/hook-core.js";
import { buildCodexHookOutput } from "../../../packages/cli/src/lib/hook-io/codex.js";
import {
  readHookPayload,
  resolvePayloadCwd,
  resolvePayloadPrompt
} from "../../../packages/cli/src/lib/hook-io/shared.js";

export { buildManualFallbackContext, readHookPayload, resolvePayloadCwd, resolvePayloadPrompt };

export function writeContinue(hookEventName, additionalContext = "") {
  process.stdout.write(`${JSON.stringify(
    buildCodexHookOutput(hookEventName, continueDecision(additionalContext)),
    null,
    2
  )}\n`);
}

export function writeBlock(reason) {
  process.stdout.write(`${JSON.stringify(
    buildCodexHookOutput("Block", { reason, status: "block" }),
    null,
    2
  )}\n`);
}
