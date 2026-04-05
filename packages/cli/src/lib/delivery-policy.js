import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { normalizeOutputPolicy } from "./output-policy.js";
import { verifyTaskState } from "../commands/verify.js";

export function normalizeDeliveryPolicy(value) {
  const policy = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    commit: normalizeActionPolicy(policy.commit, ["verify_passed", "report_generated"]),
    push: normalizeActionPolicy(policy.push, ["commit_exists"])
  };
}

export function evaluateTaskDeliveryReadiness(cwd, taskState, options = {}) {
  const deliveryPolicy = normalizeDeliveryPolicy(options.deliveryPolicy);
  const reportPolicy = normalizeOutputPolicy({
    report: options.reportPolicy
  }).report;
  const verification = verifyTaskState(taskState, { reportPolicy });
  const signalStatus = buildSignalStatus(cwd, taskState, reportPolicy, verification, options);

  return {
    signals: signalStatus,
    commit: evaluateActionReadiness("commit", deliveryPolicy.commit, signalStatus),
    push: evaluateActionReadiness("push", deliveryPolicy.push, signalStatus)
  };
}

export function summarizeDeliveryReadiness(readiness) {
  const parts = [];
  if (readiness?.commit?.configured) {
    parts.push(formatReadinessSummary("commit", readiness.commit));
  }
  if (readiness?.push?.configured) {
    parts.push(formatReadinessSummary("push", readiness.push));
  }
  return parts.join(", ");
}

function normalizeActionPolicy(value, defaultRequire) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return {
    mode: typeof value.mode === "string" ? value.mode : "explicit_only",
    via: typeof value.via === "string" ? value.via : "skill",
    require: Array.isArray(value.require) ? value.require.map((item) => String(item)) : defaultRequire
  };
}

function buildSignalStatus(cwd, taskState, reportPolicy, verification, options) {
  const taskId = taskState?.task_id ?? null;
  const reportPath = taskId ? path.join(cwd, reportPolicy.directory, `${taskId}.json`) : null;
  const reportGenerated = Boolean(options.reportWillBeGenerated) || Boolean(reportPath && fs.existsSync(reportPath));
  const commitStatus = resolveCommitExistsStatus(cwd, taskId, reportPath, options);

  return {
    verify_passed: {
      name: "verify_passed",
      satisfied: verification.allowed,
      reason: verification.allowed
        ? "verify 门禁已通过"
        : `verify 未通过: ${(verification.missing_evidence ?? []).join("；")}`
    },
    report_generated: {
      name: "report_generated",
      satisfied: reportGenerated,
      reason: reportGenerated
        ? (options.reportWillBeGenerated ? "本次 report 执行将生成报告" : "已检测到报告文件")
        : `未检测到报告文件: ${path.relative(cwd, reportPath ?? ".harness/reports/<task_id>.json")}`
    },
    commit_exists: {
      name: "commit_exists",
      satisfied: commitStatus.satisfied,
      reason: commitStatus.reason
    }
  };
}

function resolveCommitExistsStatus(cwd, taskId, reportPath, options) {
  if (options.commitExists === true) {
    return {
      satisfied: true,
      reason: "已通过显式参数确认存在提交记录"
    };
  }

  if (!taskId) {
    return {
      satisfied: false,
      reason: "缺少 task_id，无法判断任务级 commit 状态"
    };
  }

  if (!reportPath || !fs.existsSync(reportPath)) {
    return {
      satisfied: false,
      reason: "尚未检测到任务报告，无法判断任务级 commit 状态"
    };
  }

  const report = loadTaskReport(reportPath);
  const candidatePaths = collectCommitCandidatePaths(report);
  if (candidatePaths.length === 0) {
    return {
      satisfied: false,
      reason: "任务报告未提供可用于判断 commit 的候选路径"
    };
  }

  const gitStatus = spawnSync("git", ["status", "--short", "--", ...candidatePaths], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (gitStatus.error) {
    return {
      satisfied: false,
      reason: `git status 执行失败：${gitStatus.error.message}`
    };
  }

  if (gitStatus.status !== 0) {
    const stderr = String(gitStatus.stderr ?? "").trim();
    return {
      satisfied: false,
      reason: stderr || "当前目录不是可用的 git 工作区，无法判断 commit 状态"
    };
  }

  const dirtyLines = String(gitStatus.stdout ?? "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (dirtyLines.length === 0) {
    return {
      satisfied: true,
      reason: "任务相关文件当前已无未提交改动，可视为已完成本地 commit"
    };
  }

  const dirtyPaths = dirtyLines
    .map((line) => line.slice(3))
    .filter(Boolean);

  return {
    satisfied: false,
    reason: `任务相关文件仍有未提交改动: ${dirtyPaths.join(", ")}`
  };
}

function loadTaskReport(reportPath) {
  const raw = fs.readFileSync(reportPath, "utf8");
  return JSON.parse(raw);
}

function collectCommitCandidatePaths(report) {
  const actualScope = Array.isArray(report?.actual_scope) ? report.actual_scope : [];
  const outputArtifacts = report?.output_artifacts && typeof report.output_artifacts === "object"
    ? Object.values(report.output_artifacts)
    : [];

  const artifactPaths = outputArtifacts
    .filter((artifact) => artifact?.satisfied === true && typeof artifact?.path === "string" && artifact.path.trim().length > 0)
    .map((artifact) => artifact.path.trim());

  return Array.from(new Set([...actualScope, ...artifactPaths].filter(Boolean)));
}

function evaluateActionReadiness(name, policy, signalStatus) {
  if (!policy) {
    return {
      configured: false,
      mode: null,
      via: null,
      ready: null,
      required_signals: [],
      satisfied_signals: [],
      missing_signals: [],
      reason: `未配置 ${name} 策略`
    };
  }

  const requiredSignals = policy.require.filter(Boolean);
  const satisfiedSignals = requiredSignals.filter((signal) => signalStatus[signal]?.satisfied);
  const missingSignals = requiredSignals.filter((signal) => !signalStatus[signal]?.satisfied);

  return {
    configured: true,
    mode: policy.mode,
    via: policy.via,
    ready: missingSignals.length === 0,
    required_signals: requiredSignals,
    satisfied_signals: satisfiedSignals,
    missing_signals: missingSignals,
    reason: missingSignals.length === 0
      ? `${name} 已满足前置条件`
      : `缺少前置条件: ${missingSignals.join(", ")}`
  };
}

function formatReadinessSummary(name, readiness) {
  if (!readiness.configured) {
    return `${name}=unconfigured`;
  }

  const status = readiness.ready ? "yes" : "no";
  const base = `${name}=${readiness.mode} via=${readiness.via}, ready=${status}`;
  if (readiness.ready) {
    return base;
  }

  return `${base} (missing: ${readiness.missing_signals.join(", ")})`;
}
