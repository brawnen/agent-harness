export function buildCodexHookOutput(eventName, decision) {
  if (decision.status === "block") {
    return {
      decision: "block",
      reason: decision.reason
    };
  }

  if (!decision.additionalContext) {
    return {};
  }

  return {
    hookSpecificOutput: {
      additionalContext: decision.additionalContext,
      hookEventName: eventName
    }
  };
}

export function resolveCodexCompletionMessage(payload) {
  return String(payload?.last_assistant_message ?? "").trim();
}
