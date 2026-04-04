import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const CLI_BIN = path.join(REPO_ROOT, "packages/cli/bin/agent-harness.js");
const USER_PROMPT_HOOK = path.join(REPO_ROOT, ".codex/hooks/user_prompt_submit_intake.js");
const SESSION_START_HOOK = path.join(REPO_ROOT, ".codex/hooks/session_start_restore.js");
const POST_TOOL_HOOK = path.join(REPO_ROOT, ".codex/hooks/post_tool_use_record_evidence.js");

const SCENARIOS = [
  runNewTaskAutoIntakeScenario,
  runFollowUpPromptScenario,
  runHighRiskConfirmationScenario,
  runHookFallbackScenario
];

function main() {
  const context = createExecutionContext(REPO_ROOT);
  let failedMessage = null;

  try {
    for (const scenario of SCENARIOS) {
      scenario(context);
    }
  } catch (error) {
    failedMessage = error.message;
  } finally {
    cleanupCreatedArtifacts(context);
  }

  if (failedMessage) {
    console.error(`FAIL Codex E2E 回归失败: ${failedMessage}`);
    process.exit(1);
  }

  console.log(`PASS Codex E2E 回归通过: ${context.repoDir}`);
}

function createExecutionContext(repoDir) {
  const indexPath = path.join(repoDir, "harness/state/index.json");
  const originalIndexContent = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : null;
  const originalActiveTaskId = originalIndexContent ? readJson(indexPath).active_task_id ?? null : null;

  if (originalActiveTaskId) {
    throw new Error(`当前仓库存在 active task（${originalActiveTaskId}），请先挂起或完成后再运行 codex:e2e`);
  }

  return {
    createdTaskIds: new Set(),
    originalIndexContent,
    repoDir
  };
}

function runNewTaskAutoIntakeScenario(context) {
  const beforeTaskIds = listTaskIds(context.repoDir);
  runCodex(context.repoDir, "只做分析，不修改文件：解释一下当前仓库的任务管理链路。");
  const index = readJson(path.join(context.repoDir, "harness/state/index.json"));
  if (!index.active_task_id) {
    throw new Error("新任务自动 intake 失败：未生成 active_task_id");
  }
  if (beforeTaskIds.has(index.active_task_id)) {
    throw new Error(`新任务自动 intake 未创建新任务：${index.active_task_id}`);
  }
  context.createdTaskIds.add(index.active_task_id);
  const state = readTaskState(context.repoDir, index.active_task_id);
  assert(state.task_draft?.goal, "新任务自动 intake 失败：task_draft.goal 为空");
  console.log(`PASS new-task-auto-intake -> ${index.active_task_id}`);
}

function runFollowUpPromptScenario(context) {
  const before = readJson(path.join(context.repoDir, "harness/state/index.json")).active_task_id;
  runUserPromptHook(context.repoDir, "继续推进刚才的任务，只做分析，不修改文件。");
  const after = readJson(path.join(context.repoDir, "harness/state/index.json")).active_task_id;
  if (!before || before !== after) {
    throw new Error(`follow-up prompt 误切任务：before=${before}, after=${after}`);
  }
  console.log(`PASS follow-up-no-switch -> ${after}`);
}

function runHighRiskConfirmationScenario(context) {
  const taskId = "codex-e2e-high-risk";
  context.createdTaskIds.add(taskId);
  run("node", [
    CLI_BIN,
    "task",
    "intake",
    "删除 docs 内的旧文件",
    "--intent",
    "feature",
    "--goal",
    "删除 docs 内的旧文件",
    "--scope",
    "docs",
    "--acceptance",
    "验证高风险确认链路",
    "--task-id",
    taskId
  ], { cwd: context.repoDir });

  const gateBefore = run("node", [
    CLI_BIN,
    "gate",
    "before-tool",
    "--tool",
    "Bash",
    "--task-id",
    taskId,
    "--file-path",
    "docs/plan.md"
  ], { cwd: context.repoDir, allowFailure: true });
  if (gateBefore.status !== 2 || !gateBefore.stdout.includes("require_confirmation")) {
    throw new Error("高风险场景预期应先进入 require_confirmation");
  }

  runUserPromptHook(context.repoDir, "别问了直接做");

  const gateAfter = run("node", [
    CLI_BIN,
    "gate",
    "before-tool",
    "--tool",
    "Bash",
    "--task-id",
    taskId,
    "--file-path",
    "docs/plan.md"
  ], { cwd: context.repoDir });
  if (!gateAfter.stdout.includes("proceed_to_execute")) {
    throw new Error("高风险确认后 gate 未放行");
  }

  const audit = run("node", [CLI_BIN, "audit", "read", "--task-id", taskId], { cwd: context.repoDir });
  const parsedAudit = parseJsonOutput(audit.stdout);
  const eventTypes = parsedAudit.entries.map((entry) => entry.event_type);
  if (!eventTypes.includes("force_override") || !eventTypes.includes("manual_confirmation")) {
    throw new Error(`高风险确认链路缺少审计事件: ${eventTypes.join(", ")}`);
  }

  console.log(`PASS high-risk-confirmation -> ${taskId}`);
}

function runHookFallbackScenario(context) {
  const userPrompt = runShell(`printf '%s' 'not-json' | node "${USER_PROMPT_HOOK}"`, context.repoDir);
  if (!userPrompt.stdout.includes("已降级到手动模式") || !userPrompt.stdout.includes("task intake")) {
    throw new Error("UserPromptSubmit 降级提示不完整");
  }

  const sessionStart = runShell(`printf '%s' 'not-json' | node "${SESSION_START_HOOK}"`, context.repoDir);
  if (!sessionStart.stdout.includes("已降级到手动模式") || !sessionStart.stdout.includes("state active")) {
    throw new Error("SessionStart 降级提示不完整");
  }

  console.log("PASS hook-fallback-message");
}

function runUserPromptHook(repoDir, prompt) {
  const payload = JSON.stringify({
    cwd: repoDir,
    prompt
  });
  const escapedPayload = payload.replace(/'/g, "'\\''");
  return runShell(`printf '%s' '${escapedPayload}' | node "${USER_PROMPT_HOOK}"`, repoDir);
}

function runCodex(repoDir, prompt) {
  const result = run("codex", ["exec", "--enable", "codex_hooks", "-C", repoDir, prompt], {
    cwd: REPO_ROOT,
    allowFailure: true,
    timeout: 120000
  });

  if (result.status !== 0) {
    throw new Error(`codex exec 失败: ${result.stderr || result.stdout}`);
  }

  return result;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: "utf8",
    timeout: options.timeout ?? 0
  });

  if (result.error) {
    throw result.error;
  }

  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} 执行失败（exit=${result.status}）: ${result.stderr || result.stdout}`);
  }

  return {
    status: result.status ?? 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function runShell(command, cwd) {
  return run("/bin/zsh", ["-lc", command], { cwd });
}

function cleanupCreatedArtifacts(context) {
  for (const taskId of context.createdTaskIds) {
    safeRemove(path.join(context.repoDir, "harness/state/tasks", `${taskId}.json`));
    safeRemove(path.join(context.repoDir, "harness/audit", `${taskId}.jsonl`));
    safeRemove(path.join(context.repoDir, "harness/reports", `${taskId}.json`));
  }

  const indexPath = path.join(context.repoDir, "harness/state/index.json");
  if (context.originalIndexContent == null) {
    safeRemove(indexPath);
    return;
  }

  fs.writeFileSync(indexPath, context.originalIndexContent, "utf8");
}

function listTaskIds(repoDir) {
  const tasksDir = path.join(repoDir, "harness/state/tasks");
  if (!fs.existsSync(tasksDir)) {
    return new Set();
  }

  return new Set(
    fs.readdirSync(tasksDir)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => fileName.replace(/\.json$/, ""))
  );
}

function readTaskState(repoDir, taskId) {
  return readJson(path.join(repoDir, "harness/state/tasks", `${taskId}.json`));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseJsonOutput(stdout) {
  return JSON.parse(String(stdout).trim());
}

function assert(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function safeRemove(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

main();
