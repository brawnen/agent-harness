import fs from "node:fs";

import { resolveHarnessProjectRoot } from "../runtime-paths.js";

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
  return resolveHarnessProjectRoot(payload?.cwd || process.cwd());
}

export function resolvePayloadPrompt(payload) {
  if (typeof payload?.prompt === "string") {
    return payload.prompt;
  }
  if (typeof payload?.input === "string") {
    return payload.input;
  }
  return "";
}

export function firstDefined(values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
}

export function firstString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function writeHookOutput(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
