import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { evaluateTaskDeliveryReadiness, normalizeDeliveryPolicy } from "../lib/delivery-policy.js";
import { normalizeOutputPolicy } from "../lib/output-policy.js";
import { loadProjectConfig } from "../lib/project-config.js";
import { runtimeRelativeCandidates } from "../lib/runtime-paths.js";
import { requireTaskState, resolveTaskId } from "../lib/state-store.js";
import { evaluateTaskWorkflowDecision, normalizeWorkflowPolicy } from "../lib/workflow-policy.js";

const VALID_ACTIONS = new Set(["commit", "push"]);

export function runDelivery(argv) {
  const [subcommand, ...rest] = argv;

  if (!subcommand) {
    console.error("缺少 delivery 子命令。可用: ready, request, commit");
    return 1;
  }

  if (subcommand === "ready") {
    return runDeliveryReady(rest);
  }

  if (subcommand === "request") {
    return runDeliveryRequest(rest);
  }

  if (subcommand === "commit") {
    return runDeliveryCommit(rest);
  }

  console.error(`未知 delivery 子命令: ${subcommand}。可用: ready, request, commit`);
  return 1;
}

function runDeliveryReady(argv) {
  const parsed = parseTaskIdArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  try {
    const cwd = process.cwd();
    const taskId = resolveTaskId(cwd, parsed.options.taskId);
    const taskState = requireTaskState(cwd, taskId);
    const readiness = buildDeliveryReadiness(cwd, taskState);

    printJson({
      task_id: taskId,
      delivery_readiness: readiness,
      workflow_decision: buildWorkflowDecision(cwd, taskState)
    });
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function runDeliveryRequest(argv) {
  const parsed = parseDeliveryRequestArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  try {
    const cwd = process.cwd();
    const taskId = resolveTaskId(cwd, parsed.options.taskId);
    const taskState = requireTaskState(cwd, taskId);
    const readiness = buildDeliveryReadiness(cwd, taskState);
    const actionReadiness = readiness[parsed.options.action];

    const result = {
      task_id: taskId,
      action: parsed.options.action,
      allowed: actionReadiness?.ready === true,
      via: actionReadiness?.via ?? null,
      delivery_readiness: readiness,
      workflow_decision: buildWorkflowDecision(cwd, taskState),
      requested_at: new Date().toISOString()
    };

    printJson(result);
    return result.allowed ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function runDeliveryCommit(argv) {
  const parsed = parseDeliveryCommitArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  try {
    const cwd = process.cwd();
    ensureGitRepository(cwd);
    const taskId = resolveTaskId(cwd, parsed.options.taskId);
    const taskState = requireTaskState(cwd, taskId);
    const readiness = buildDeliveryReadiness(cwd, taskState);
    const actionReadiness = readiness.commit;

    if (actionReadiness?.ready !== true) {
      printJson({
        task_id: taskId,
        action: "commit",
        allowed: false,
        via: actionReadiness?.via ?? null,
        delivery_readiness: readiness,
        workflow_decision: buildWorkflowDecision(cwd, taskState),
        requested_at: new Date().toISOString()
      });
      return 1;
    }

    const report = loadTaskReport(cwd, taskId);
    const commitPlan = buildCommitPlan(cwd, report, parsed.options);
    if (commitPlan.paths.length === 0) {
      throw new Error("未能从报告中推导出可提交文件，请先补充 report actual_scope 或 output_artifacts");
    }

    const commitMessage = parsed.options.message ?? buildCommitMessage(report);
    if (commitPlan.wide_scope.length > 0 && !parsed.options.forceWideScope) {
      const result = {
        task_id: taskId,
        action: "commit",
        allowed: false,
        via: actionReadiness.via ?? null,
        dry_run: parsed.options.dryRun,
        commit_message: commitMessage,
        staged_paths: commitPlan.paths,
        wide_scope: commitPlan.wide_scope,
        reason: `检测到过宽 scope，需显式使用 --force-wide-scope: ${commitPlan.wide_scope.join(", ")}`,
        delivery_readiness: readiness,
        workflow_decision: buildWorkflowDecision(cwd, taskState),
        requested_at: new Date().toISOString()
      };
      printJson(result);
      return 1;
    }

    if (parsed.options.dryRun) {
      printJson({
        task_id: taskId,
        action: "commit",
        allowed: true,
        via: actionReadiness.via ?? null,
        dry_run: true,
        commit_message: commitMessage,
        staged_paths: commitPlan.paths,
        wide_scope: commitPlan.wide_scope,
        delivery_readiness: readiness,
        workflow_decision: buildWorkflowDecision(cwd, taskState),
        requested_at: new Date().toISOString()
      });
      return 0;
    }

    stageCommitPaths(cwd, commitPlan.paths);
    runGit(cwd, ["commit", "-m", commitMessage]);

    const result = {
      task_id: taskId,
      action: "commit",
      allowed: true,
      via: actionReadiness.via ?? null,
      commit_message: commitMessage,
      staged_paths: commitPlan.paths,
      wide_scope: commitPlan.wide_scope,
      commit_sha: getHeadSha(cwd),
      delivery_readiness: readiness,
      workflow_decision: buildWorkflowDecision(cwd, taskState),
      requested_at: new Date().toISOString()
    };

    printJson(result);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function buildDeliveryReadiness(cwd, taskState) {
  const projectConfig = loadProjectConfig(cwd);
  return evaluateTaskDeliveryReadiness(cwd, taskState, {
    deliveryPolicy: normalizeDeliveryPolicy(projectConfig?.delivery_policy),
    reportPolicy: normalizeOutputPolicy(projectConfig?.output_policy).report
  });
}

function buildWorkflowDecision(cwd, taskState) {
  if (taskState?.workflow_decision && typeof taskState.workflow_decision === "object") {
    return taskState.workflow_decision;
  }

  const projectConfig = loadProjectConfig(cwd);
  return evaluateTaskWorkflowDecision(taskState, {
    workflowPolicy: normalizeWorkflowPolicy(projectConfig?.workflow_policy),
    outputPolicy: normalizeOutputPolicy(projectConfig?.output_policy),
    previousDecision: taskState.workflow_decision
  });
}

function parseDeliveryCommitArgs(argv) {
  const options = {
    dryRun: false,
    forceWideScope: false,
    message: null,
    taskId: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--force-wide-scope") {
      options.forceWideScope = true;
      continue;
    }
    if (arg === "--task-id") {
      options.taskId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--message") {
      options.message = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  return { ok: true, options };
}

function parseTaskIdArgs(argv) {
  const options = { taskId: null };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--task-id") {
      options.taskId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  return { ok: true, options };
}

function parseDeliveryRequestArgs(argv) {
  const options = {
    action: null,
    taskId: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--task-id") {
      options.taskId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--action") {
      const value = argv[index + 1] ?? null;
      if (!VALID_ACTIONS.has(value)) {
        return { ok: false, error: "无效的 --action 参数。可选值: commit, push" };
      }
      options.action = value;
      index += 1;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  if (!options.action) {
    return { ok: false, error: "需要 --action 参数。可选值: commit, push" };
  }

  return { ok: true, options };
}

function printJson(value) {
  console.log(`${JSON.stringify(value, null, 2)}\n`);
}

function ensureGitRepository(cwd) {
  try {
    runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    throw new Error("当前目录不是 git repository，无法执行 delivery commit");
  }
}

function loadTaskReport(cwd, taskId) {
  const projectConfig = loadProjectConfig(cwd);
  const reportDirectory = normalizeOutputPolicy(projectConfig?.output_policy).report.directory;
  const reportPath = path.join(cwd, reportDirectory, `${taskId}.json`);
  if (!fs.existsSync(reportPath)) {
    throw new Error(`缺少任务报告: ${reportPath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch {
    throw new Error(`任务报告 JSON 解析失败: ${reportPath}`);
  }
}

function buildCommitPlan(cwd, report, options) {
  const reportScope = Array.isArray(report?.actual_scope) ? report.actual_scope : [];
  const artifactPaths = Object.values(report?.output_artifacts ?? {})
    .filter((artifact) => artifact?.satisfied === true && typeof artifact?.path === "string" && artifact.path.trim().length > 0)
    .map((artifact) => artifact.path.trim());

  const candidates = [...reportScope, ...artifactPaths]
    .map((item) => normalizeRepoPath(item))
    .filter(Boolean);

  const resolvedPaths = resolveCommitPaths(cwd, candidates);
  const wideScope = detectWideScope(cwd, candidates);

  return {
    message: options.message ?? null,
    paths: resolvedPaths,
    wide_scope: wideScope
  };
}

function normalizeRepoPath(value) {
  const normalized = String(value ?? "").trim().replace(/\\/g, "/");
  if (!normalized || normalized === ".") {
    return null;
  }

  if (normalized.startsWith("./")) {
    return normalizeRepoPath(normalized.slice(2));
  }

  return normalized;
}

function buildCommitMessage(report) {
  const prefix = resolveCommitPrefix(report?.intent);
  const summary = String(report?.conclusion ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 72);

  if (!summary) {
    throw new Error("无法从 report conclusion 生成 commit message，请使用 --message 显式指定");
  }

  return `${prefix}: ${summary}`;
}

function resolveCommitPrefix(intent) {
  if (intent === "feature") {
    return "feat";
  }
  if (intent === "bug") {
    return "fix";
  }
  if (intent === "refactor") {
    return "refactor";
  }
  return "chore";
}

function stageCommitPaths(cwd, paths) {
  runGit(cwd, ["add", "-A", "--", ...paths]);
}

function resolveCommitPaths(cwd, candidates) {
  const changedFiles = listChangedFiles(cwd);
  const changedSet = new Set(changedFiles);
  const resolved = new Set();
  const excludedPrefixes = runtimeRelativeCandidates("reports");

  for (const candidate of candidates) {
    if (!candidate || excludedPrefixes.some((prefix) => candidate.startsWith(`${prefix}/`) || candidate === prefix)) {
      continue;
    }

    const fullPath = path.join(cwd, candidate);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      const prefix = `${candidate.replace(/\/+$/, "")}/`;
      for (const file of changedFiles) {
        if (file === candidate || file.startsWith(prefix)) {
          resolved.add(file);
        }
      }
      continue;
    }

    if (changedSet.has(candidate)) {
      resolved.add(candidate);
      continue;
    }

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      resolved.add(candidate);
    }
  }

  return [...resolved];
}

function detectWideScope(cwd, candidates) {
  const wide = [];
  const excludedPrefixes = runtimeRelativeCandidates("reports");

  for (const candidate of candidates) {
    if (!candidate || excludedPrefixes.some((prefix) => candidate.startsWith(`${prefix}/`) || candidate === prefix)) {
      continue;
    }

    const fullPath = path.join(cwd, candidate);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      continue;
    }

    const normalized = candidate.replace(/\/+$/, "");
    const segments = normalized.split("/").filter(Boolean);
    if (segments.length <= 1) {
      wide.push(candidate);
      continue;
    }

    if (segments.length === 2 && ["packages", "apps", "services"].includes(segments[0])) {
      wide.push(candidate);
    }
  }

  return [...new Set(wide)];
}

function listChangedFiles(cwd) {
  const output = runGit(cwd, ["status", "--short", "--untracked-files=all"]);
  if (!output) {
    return [];
  }

  return output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => extractStatusPath(line))
    .map((file) => normalizeRepoPath(file))
    .filter(Boolean);
}

function extractStatusPath(line) {
  const rawPath = line.slice(3).trim();
  const renameArrow = rawPath.lastIndexOf(" -> ");
  if (renameArrow >= 0) {
    return rawPath.slice(renameArrow + 4).trim();
  }
  return rawPath;
}

function getHeadSha(cwd) {
  return runGit(cwd, ["rev-parse", "--short", "HEAD"]);
}

function runGit(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trimEnd();
}
