import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const CLI_BIN = path.join(REPO_ROOT, "packages/cli/bin/agent-harness.js");

const LEGACY_CASES = [
  {
    configPath: ".claude/settings.json",
    host: "claude-code",
    rewriteConfig: rewriteLegacyClaudeSettings,
    statusFragment: "Claude Code hooks 已配置"
  },
  {
    configPath: ".gemini/settings.json",
    host: "gemini-cli",
    rewriteConfig: rewriteLegacyGeminiSettings,
    statusFragment: "Gemini CLI hooks 已配置"
  }
];

main();

function main() {
  for (const legacyCase of LEGACY_CASES) {
    verifyLegacyCompatibility(legacyCase);
  }

  console.log(`PASS sync/status compatibility -> ${LEGACY_CASES.map((legacyCase) => legacyCase.host).join(", ")}`);
}

function verifyLegacyCompatibility(legacyCase) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `agent-harness-compat-${legacyCase.host}-`));

  try {
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({
      name: `compat-${legacyCase.host}`,
      private: true,
      version: "0.0.0"
    }, null, 2));

    run("node", [CLI_BIN, "init", "--host", legacyCase.host], tempDir);
    legacyCase.rewriteConfig(tempDir);

    const status = run("node", [CLI_BIN, "status"], tempDir, { allowFailure: true });
    if (![0, 1].includes(status.status)) {
      throw new Error(`${legacyCase.host} status 执行异常（exit=${status.status}）: ${status.stderr || status.stdout}`);
    }
    if (!status.stdout.includes(legacyCase.statusFragment)) {
      throw new Error(`${legacyCase.host} status 未识别 legacy CLI 入口`);
    }

    const syncCheck = run("node", [CLI_BIN, "sync", "--check", "--host", legacyCase.host], tempDir, { allowFailure: true });
    if (syncCheck.status !== 1) {
      throw new Error(`${legacyCase.host} legacy 配置未触发 sync drift 检测`);
    }
    if (!syncCheck.stdout.includes(`drift: ${legacyCase.configPath}`)) {
      throw new Error(`${legacyCase.host} legacy 配置未命中预期 drift: ${legacyCase.configPath}`);
    }
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
}

function rewriteLegacyClaudeSettings(tempDir) {
  fs.writeFileSync(path.join(tempDir, ".claude", "settings.json"), JSON.stringify({
    hooks: {
      SessionStart: [{
        matcher: "startup|resume|clear|compact",
        hooks: [{
          type: "command",
          command: "node \"$CLAUDE_PROJECT_DIR/packages/cli/bin/agent-harness.js\" hook claude session-start"
        }]
      }],
      UserPromptSubmit: [{
        hooks: [{
          type: "command",
          command: "node \"$CLAUDE_PROJECT_DIR/packages/cli/bin/agent-harness.js\" hook claude user-prompt-submit"
        }]
      }],
      PreToolUse: [{
        matcher: "Write|Edit|Bash|NotebookEdit",
        hooks: [{
          type: "command",
          command: "node \"$CLAUDE_PROJECT_DIR/packages/cli/bin/agent-harness.js\" gate before-tool --tool \\\"$CLAUDE_TOOL_NAME\\\""
        }]
      }],
      PostToolUse: [{
        matcher: ".*",
        hooks: [{
          type: "command",
          command: "node \"$CLAUDE_PROJECT_DIR/packages/cli/bin/agent-harness.js\" state update --task-id \"$CLAUDE_TASK_ID\""
        }]
      }],
      Stop: [{
        hooks: [{
          type: "command",
          command: "node \"$CLAUDE_PROJECT_DIR/packages/cli/bin/agent-harness.js\" hook claude stop"
        }]
      }]
    }
  }, null, 2));
}

function rewriteLegacyGeminiSettings(tempDir) {
  fs.writeFileSync(path.join(tempDir, ".gemini", "settings.json"), JSON.stringify({
    hooks: {
      SessionStart: [{
        matcher: "*",
        hooks: [{
          type: "command",
          command: "node \"$(git rev-parse --show-toplevel)/packages/cli/bin/agent-harness.js\" hook gemini session-start"
        }]
      }],
      BeforeAgent: [{
        matcher: "*",
        hooks: [{
          type: "command",
          command: "node \"$(git rev-parse --show-toplevel)/packages/cli/bin/agent-harness.js\" hook gemini before-agent"
        }]
      }],
      BeforeTool: [{
        matcher: "run_shell_command|write_file|replace",
        hooks: [{
          type: "command",
          command: "node \"$(git rev-parse --show-toplevel)/packages/cli/bin/agent-harness.js\" hook gemini before-tool"
        }]
      }],
      AfterTool: [{
        matcher: "run_shell_command|write_file|replace",
        hooks: [{
          type: "command",
          command: "node \"$(git rev-parse --show-toplevel)/packages/cli/bin/agent-harness.js\" hook gemini after-tool"
        }]
      }],
      AfterAgent: [{
        matcher: "*",
        hooks: [{
          type: "command",
          command: "node \"$(git rev-parse --show-toplevel)/packages/cli/bin/agent-harness.js\" hook gemini after-agent"
        }]
      }]
    }
  }, null, 2));
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
