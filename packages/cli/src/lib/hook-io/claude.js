export function buildClaudeHookOutput(eventName, decision) {
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

export function resolveClaudeCompletionMessage(payload) {
  return String(payload?.last_assistant_message ?? "").trim();
}
