import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

const CASES = [
  {
    expectedFragment: "\"hookEventName\": \"SessionStart\"",
    file: ".harness/hosts/codex/hooks/session_start_restore.js",
    payload: { cwd: REPO_ROOT },
    title: "codex-session-start"
  },
  {
    file: ".harness/hosts/codex/hooks/user_prompt_submit_intake.js",
    payload: { cwd: REPO_ROOT, prompt: "继续推进当前任务，只做分析。" },
    title: "codex-user-prompt"
  },
  {
    expectedFragment: "\"hookEventName\": \"SessionStart\"",
    file: ".harness/hosts/claude/hooks/session_start.js",
    payload: { cwd: REPO_ROOT },
    title: "claude-session-start"
  },
  {
    file: ".harness/hosts/claude/hooks/user_prompt_submit.js",
    payload: { cwd: REPO_ROOT, prompt: "继续推进当前任务，只做分析。" },
    title: "claude-user-prompt"
  },
  {
    file: ".harness/hosts/claude/hooks/pre_tool_use.js",
    payload: { cwd: REPO_ROOT, tool_name: "Bash", tool_input: { command: "pwd" } },
    title: "claude-pre-tool"
  },
  {
    file: ".harness/hosts/claude/hooks/post_tool_use.js",
    payload: { cwd: REPO_ROOT, tool_name: "Bash", exit_code: 0 },
    title: "claude-post-tool"
  },
  {
    file: ".harness/hosts/claude/hooks/stop.js",
    payload: { cwd: REPO_ROOT, last_assistant_message: "继续处理中" },
    title: "claude-stop"
  },
  {
    file: ".harness/hosts/gemini/hooks/session_start.js",
    payload: { cwd: REPO_ROOT },
    title: "gemini-session-start"
  },
  {
    file: ".harness/hosts/gemini/hooks/before_agent.js",
    payload: { cwd: REPO_ROOT, prompt: "继续推进当前任务，只做分析。" },
    title: "gemini-before-agent"
  },
  {
    file: ".harness/hosts/gemini/hooks/before_tool.js",
    payload: { cwd: REPO_ROOT, tool_name: "run_shell_command", tool_input: { command: "pwd" } },
    title: "gemini-before-tool"
  },
  {
    file: ".harness/hosts/gemini/hooks/after_tool.js",
    payload: { cwd: REPO_ROOT, tool_name: "run_shell_command", tool_input: { command: "pwd" }, result: { exit_code: 0, stdout: "/tmp" } },
    title: "gemini-after-tool"
  },
  {
    file: ".harness/hosts/gemini/hooks/after_agent.js",
    payload: { cwd: REPO_ROOT, last_assistant_message: "继续处理中" },
    title: "gemini-after-agent"
  }
];

main();

function main() {
  for (const testCase of CASES) {
    const result = runHook(testCase.file, testCase.payload);
    try {
      JSON.parse(result.stdout);
    } catch {
      throw new Error(`${testCase.title} 输出不是合法 JSON: ${result.stdout}`);
    }

    if (testCase.expectedFragment && !result.stdout.includes(testCase.expectedFragment)) {
      throw new Error(`${testCase.title} 缺少预期输出片段: ${testCase.expectedFragment}`);
    }
  }

  console.log(`PASS host hook smoke -> ${CASES.length} cases`);
}

function runHook(relativePath, payload) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  const result = spawnSync("node", [absolutePath], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    input: `${JSON.stringify(payload)}\n`
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${relativePath} 执行失败（exit=${result.status}）: ${result.stderr || result.stdout}`);
  }

  return {
    stdout: result.stdout ?? ""
  };
}
