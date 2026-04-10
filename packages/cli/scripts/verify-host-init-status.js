import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const CLI_BIN = path.join(REPO_ROOT, "packages/cli/bin/agent-harness.js");

const HOST_CASES = [
  {
    expectedFiles: [
      ".codex/config.toml",
      ".codex/hooks.json",
      ".harness/hosts/codex/hooks/user_prompt_submit_intake.js",
      ".harness/hosts/codex/hooks/session_start_restore.js",
      ".harness/hosts/codex/hooks/shared/codex-hook-io.js"
    ],
    expectedFragments: [
      ".harness/hosts/codex/hooks/user_prompt_submit_intake.js",
      ".harness/hosts/codex/hooks/session_start_restore.js"
    ],
    host: "codex",
    statusFragment: "Codex hooks 已配置"
  },
  {
    expectedFiles: [
      ".claude/settings.json",
      ".harness/hosts/claude/hooks/session_start.js",
      ".harness/hosts/claude/hooks/user_prompt_submit.js",
      ".harness/hosts/claude/hooks/pre_tool_use.js",
      ".harness/hosts/claude/hooks/post_tool_use.js",
      ".harness/hosts/claude/hooks/stop.js"
    ],
    expectedFragments: [
      ".harness/hosts/claude/hooks/session_start.js",
      ".harness/hosts/claude/hooks/user_prompt_submit.js",
      ".harness/hosts/claude/hooks/pre_tool_use.js",
      ".harness/hosts/claude/hooks/post_tool_use.js",
      ".harness/hosts/claude/hooks/stop.js"
    ],
    host: "claude-code",
    statusFragment: "Claude Code hooks 已配置"
  },
  {
    expectedFiles: [
      ".gemini/settings.json",
      ".harness/hosts/gemini/hooks/session_start.js",
      ".harness/hosts/gemini/hooks/before_agent.js",
      ".harness/hosts/gemini/hooks/before_tool.js",
      ".harness/hosts/gemini/hooks/after_tool.js",
      ".harness/hosts/gemini/hooks/after_agent.js"
    ],
    expectedFragments: [
      ".harness/hosts/gemini/hooks/session_start.js",
      ".harness/hosts/gemini/hooks/before_agent.js",
      ".harness/hosts/gemini/hooks/before_tool.js",
      ".harness/hosts/gemini/hooks/after_tool.js",
      ".harness/hosts/gemini/hooks/after_agent.js"
    ],
    host: "gemini-cli",
    statusFragment: "Gemini CLI hooks 已配置"
  }
];

main();

function main() {
  for (const hostCase of HOST_CASES) {
    verifyHost(hostCase);
  }

  console.log(`PASS host init/status smoke -> ${HOST_CASES.map((hostCase) => hostCase.host).join(", ")}`);
}

function verifyHost(hostCase) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `agent-harness-${hostCase.host}-`));

  try {
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({
      name: `smoke-${hostCase.host}`,
      private: true,
      version: "0.0.0"
    }, null, 2));

    run("node", [CLI_BIN, "init", "--host", hostCase.host], tempDir);
    run("node", [CLI_BIN, "sync", "--check", "--host", hostCase.host], tempDir);

    for (const relativePath of [
      "harness.yaml",
      ".harness/hosts/shared/payload-io.js",
      ".harness/hosts/shared/runtime-loader.js",
      ...hostCase.expectedFiles
    ]) {
      assertFileExists(tempDir, relativePath);
    }

    const settingsOrHooksPath = resolveHostConfigPath(hostCase.host);
    const content = fs.readFileSync(path.join(tempDir, settingsOrHooksPath), "utf8");
    for (const fragment of hostCase.expectedFragments) {
      if (!content.includes(fragment)) {
        throw new Error(`${hostCase.host} 生成物缺少预期入口: ${fragment}`);
      }
    }

    const status = run("node", [CLI_BIN, "status"], tempDir, { allowFailure: true });
    if (![0, 1].includes(status.status)) {
      throw new Error(`${hostCase.host} status 执行异常（exit=${status.status}）: ${status.stderr || status.stdout}`);
    }

    if (!status.stdout.includes(hostCase.statusFragment)) {
      throw new Error(`${hostCase.host} status 未识别宿主接入状态`);
    }
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
}

function resolveHostConfigPath(host) {
  if (host === "codex") {
    return ".codex/hooks.json";
  }
  if (host === "claude-code") {
    return ".claude/settings.json";
  }
  return ".gemini/settings.json";
}

function assertFileExists(cwd, relativePath) {
  if (!fs.existsSync(path.join(cwd, relativePath))) {
    throw new Error(`缺少预期文件: ${relativePath}`);
  }
}

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8"
  });

  if (result.error) {
    throw result.error;
  }

  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} 执行失败（exit=${result.status}）: ${result.stderr || result.stdout}`);
  }

  return {
    status: result.status ?? 0,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? ""
  };
}
