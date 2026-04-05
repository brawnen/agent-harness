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
  const directCandidate = firstString([
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

  if (directCandidate) {
    return normalizeCandidatePath(directCandidate, cwd);
  }

  if (resolveToolName(payload) !== "Bash") {
    return null;
  }

  const command = resolveCommand(payload);
  if (!command) {
    return null;
  }

  const inferredPath = inferBashTargetPath(command);
  if (!inferredPath) {
    return null;
  }

  return normalizeCandidatePath(inferredPath, cwd);
}

function resolveTaskId(payload) {
  return firstString([
    payload?.task_id,
    payload?.taskId,
    payload?.context?.task_id,
    payload?.context?.taskId
  ]);
}

function resolveCommand(payload) {
  return firstString([
    payload?.tool_input?.command,
    payload?.toolInput?.command,
    payload?.input?.command,
    payload?.arguments?.command,
    payload?.tool_use?.input?.command,
    payload?.toolUse?.input?.command,
    payload?.command
  ]);
}

function normalizeCandidatePath(candidate, cwd) {
  if (path.isAbsolute(candidate)) {
    return path.relative(cwd, candidate).replace(/\\/g, "/");
  }
  return candidate;
}

function inferBashTargetPath(command) {
  const unwrapped = unwrapShellCommand(command);

  const redirectMatch = unwrapped.match(/(?:^|\s)(?:\d?>|>>|>\|)\s*(['"]?)([^'" \t;|&]+)\1/);
  if (redirectMatch) {
    return redirectMatch[2];
  }

  const teeMatch = unwrapped.match(/\btee\s+(?:-a\s+)?(['"]?)([^'" \t;|&]+)\1/);
  if (teeMatch) {
    return teeMatch[2];
  }

  const mkdirMatch = unwrapped.match(/\bmkdir\s+(?:-p\s+)?(['"]?)([^'" \t;|&]+)\1/);
  if (mkdirMatch) {
    return mkdirMatch[2];
  }

  const installTarget = inferInstallTarget(unwrapped);
  if (installTarget) {
    return installTarget;
  }

  const touchMatch = unwrapped.match(/\btouch\s+(['"]?)([^'" \t;|&]+)\1/);
  if (touchMatch) {
    return touchMatch[2];
  }

  const sedTarget = inferInPlaceEditorTarget(unwrapped, "sed");
  if (sedTarget) {
    return sedTarget;
  }

  const perlTarget = inferInPlaceEditorTarget(unwrapped, "perl");
  if (perlTarget) {
    return perlTarget;
  }

  const rmMatch = unwrapped.match(/\brm\s+(?:-rf?\s+)?(['"]?)([^'" \t;|&]+)\1/);
  if (rmMatch) {
    return rmMatch[2];
  }

  const metadataTarget = inferMetadataTarget(unwrapped);
  if (metadataTarget) {
    return metadataTarget;
  }

  const truncateTarget = inferTruncateTarget(unwrapped);
  if (truncateTarget) {
    return truncateTarget;
  }

  const ddTarget = inferDdTarget(unwrapped);
  if (ddTarget) {
    return ddTarget;
  }

  const copyMoveMatch = unwrapped.match(/\b(?:mv|cp)\s+(['"]?)([^'" \t;|&]+)\1\s+(['"]?)([^'" \t;|&]+)\3/);
  if (copyMoveMatch) {
    return copyMoveMatch[4];
  }

  const rsyncTarget = inferRsyncTarget(unwrapped);
  if (rsyncTarget) {
    return rsyncTarget;
  }

  const linkMatch = unwrapped.match(/\bln\b(?:\s+-[^\s]+\b)*\s+(['"]?)([^'" \t;|&]+)\1\s+(['"]?)([^'" \t;|&]+)\3/);
  if (linkMatch) {
    return linkMatch[4];
  }

  return null;
}

function unwrapShellCommand(command) {
  let current = String(command ?? "").trim();
  const wrappers = [
    /^(?:sh|bash|zsh)\s+-lc\s+(['"])([\s\S]+)\1$/,
    /^(?:sh|bash|zsh)\s+-c\s+(['"])([\s\S]+)\1$/
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of wrappers) {
      const match = current.match(pattern);
      if (match) {
        current = match[2].trim();
        changed = true;
        break;
      }
    }
  }

  return current;
}

function inferInPlaceEditorTarget(command, binaryName) {
  const tokens = tokenizeShellLike(command);
  if (tokens[0] !== binaryName) {
    return null;
  }

  const hasInPlaceFlag = tokens.some((token) => isInPlaceFlag(token, binaryName));
  if (!hasInPlaceFlag) {
    return null;
  }

  for (let index = tokens.length - 1; index >= 1; index -= 1) {
    const token = tokens[index];
    if (!token || token.startsWith("-")) {
      continue;
    }
    return token;
  }

  return null;
}

function inferMetadataTarget(command) {
  const tokens = tokenizeShellLike(command);
  if (tokens.length < 2) {
    return null;
  }

  const commandName = tokens[0];
  if (!["chmod", "chown", "chgrp"].includes(commandName)) {
    return null;
  }

  for (let index = tokens.length - 1; index >= 1; index -= 1) {
    const token = tokens[index];
    if (!token || token.startsWith("-")) {
      continue;
    }
    return token;
  }

  return null;
}

function inferTruncateTarget(command) {
  const tokens = tokenizeShellLike(command);
  if (tokens[0] !== "truncate" || tokens.length < 2) {
    return null;
  }

  for (let index = tokens.length - 1; index >= 1; index -= 1) {
    const token = tokens[index];
    if (!token || token.startsWith("-")) {
      continue;
    }

    const previous = tokens[index - 1];
    if (previous === "-s" || previous === "--size") {
      continue;
    }

    return token;
  }

  return null;
}

function inferDdTarget(command) {
  const tokens = tokenizeShellLike(command);
  if (tokens[0] !== "dd") {
    return null;
  }

  for (const token of tokens.slice(1)) {
    if (token.startsWith("of=") && token.length > 3) {
      return token.slice(3);
    }
  }

  return null;
}

function inferInstallTarget(command) {
  const tokens = tokenizeShellLike(command);
  if (tokens[0] !== "install" || tokens.length < 2) {
    return null;
  }

  const positional = [];
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) {
      continue;
    }

    if (token === "-d" || token === "--directory") {
      const nextToken = tokens[index + 1];
      return nextToken && !nextToken.startsWith("-") ? nextToken : null;
    }

    if (token === "-m" || token === "--mode" || token === "-o" || token === "--owner" || token === "-g" || token === "--group" || token === "-T" || token === "--target-directory") {
      index += 1;
      continue;
    }

    if (token.startsWith("-")) {
      continue;
    }

    positional.push(token);
  }

  if (positional.length >= 2) {
    return positional[positional.length - 1];
  }

  return null;
}

function inferRsyncTarget(command) {
  const tokens = tokenizeShellLike(command);
  if (tokens[0] !== "rsync" || tokens.length < 3) {
    return null;
  }

  const positional = [];
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) {
      continue;
    }

    if (token === "-e" || token === "--rsh" || token === "--rsync-path" || token === "--exclude" || token === "--include" || token === "--filter" || token === "--files-from" || token === "--exclude-from" || token === "--include-from") {
      index += 1;
      continue;
    }

    if (token.startsWith("-")) {
      continue;
    }

    positional.push(token);
  }

  if (positional.length < 2) {
    return null;
  }

  const destination = positional[positional.length - 1];
  if (/^[^/:\s]+:.+/.test(destination)) {
    return null;
  }

  return destination;
}

function isInPlaceFlag(token, binaryName) {
  if (binaryName === "sed") {
    return token === "-i" || token.startsWith("-i");
  }

  if (binaryName === "perl") {
    return /^-[A-Za-z]*i[A-Za-z]*$/.test(token);
  }

  return false;
}

function tokenizeShellLike(command) {
  const tokens = [];
  let current = "";
  let quote = null;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];

    if (quote) {
      if (char === quote) {
        quote = null;
        continue;
      }
      current += char;
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function firstString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}
