import { spawnSync } from "node:child_process";
import { setActiveTaskId } from "../../packages/cli/src/lib/state-store.js";
import path from "node:path";

import {
  buildManualFallbackContext,
  readHookPayload,
  resolvePayloadCwd,
  writeBlock,
  writeContinue
} from "./shared/codex-hook-io.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");
  const toolName = resolveToolName(payload);
  const taskId = resolveTaskId(payload);

  if (!toolName || !isSupportedTool(toolName)) {
    writeContinue("PreToolUse");
    process.exit(0);
  }

  if (taskId) {
    setActiveTaskId(cwd, taskId);
  }

  const gateArgs = [
    path.join(repoRoot, "packages/cli/bin/agent-harness.js"),
    "gate",
    "before-tool",
    "--tool",
    toolName
  ];

  const filePath = resolveFilePath(payload, cwd);
  if (filePath) {
    gateArgs.push("--file-path", filePath);
  }
  if (taskId) {
    gateArgs.push("--task-id", taskId);
  }

  const gateExecution = spawnSync("node", gateArgs, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (gateExecution.error) {
    throw gateExecution.error;
  }

  const raw = String(gateExecution.stdout ?? "").trim();
  if (!raw) {
    const stderr = String(gateExecution.stderr ?? "").trim();
    throw new Error(stderr || "gate before-tool 未返回 JSON 结果");
  }

  const result = JSON.parse(raw || "{}");
  if (result.signal === "block_execution" || result.signal === "require_confirmation") {
    writeBlock(result.reason ?? "当前工具调用被 agent-harness 门禁阻断");
    process.exit(0);
  }

  writeContinue("PreToolUse");
} catch (error) {
  writeContinue("PreToolUse", buildManualFallbackContext(`Codex PreToolUse 门禁检查失败：${error.message}`, {
    commands: [
      "node packages/cli/bin/agent-harness.js state active",
      "node packages/cli/bin/agent-harness.js gate before-tool --tool Write --file-path <path>"
    ]
  }));
}

function isSupportedTool(toolName) {
  return ["Write", "Edit", "NotebookEdit", "Bash"].includes(toolName);
}

function resolveToolName(payload) {
  const values = [
    payload?.tool_name,
    payload?.toolName,
    payload?.tool?.name,
    payload?.toolUse?.name,
    payload?.name
  ];

  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function resolveFilePath(payload, cwd) {
  const candidate = firstString([
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

  if (!candidate) {
    return null;
  }

  if (path.isAbsolute(candidate)) {
    return path.relative(cwd, candidate).replace(/\\/g, "/");
  }

  return candidate;
}

function resolveTaskId(payload) {
  return firstString([
    payload?.task_id,
    payload?.taskId,
    payload?.context?.task_id,
    payload?.context?.taskId
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
