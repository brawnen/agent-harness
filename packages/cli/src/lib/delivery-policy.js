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
  const commitExists = options.commitExists === true;

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
        : `未检测到报告文件: ${path.relative(cwd, reportPath ?? "harness/reports/<task_id>.json")}`
    },
    commit_exists: {
      name: "commit_exists",
      satisfied: commitExists,
      reason: commitExists
        ? "已确认存在提交记录"
        : "当前未接入任务级 git commit 检测"
    }
  };
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
