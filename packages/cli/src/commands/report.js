import fs from "node:fs";
import path from "node:path";

import { readAuditEntries } from "../lib/audit-store.js";
import { evaluateTaskDeliveryReadiness, normalizeDeliveryPolicy } from "../lib/delivery-policy.js";
import { normalizeOutputPolicy, validateTaskOutputArtifacts } from "../lib/output-policy.js";
import { loadProjectConfig } from "../lib/project-config.js";
import { requireTaskState, resolveTaskId, updateTaskState } from "../lib/state-store.js";
import { verifyTaskState } from "./verify.js";

const SCHEMA_VERSION = "0.3";

export function runReport(argv) {
  const parsed = parseReportArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  try {
    const cwd = process.cwd();
    const taskId = resolveTaskId(cwd, parsed.options.taskId);
    const taskState = requireTaskState(cwd, taskId);
    const projectConfig = loadProjectConfig(cwd);
    const outputPolicy = normalizeOutputPolicy(projectConfig?.output_policy);
    const reportPolicy = outputPolicy.report;
    const verification = verifyTaskState(taskState, { reportPolicy });

    if (!verification.allowed) {
      console.log(`${JSON.stringify(verification, null, 2)}\n`);
      return 1;
    }

    const outputArtifacts = validateTaskOutputArtifacts(cwd, taskState, outputPolicy, {
      adr: parsed.options.adr,
      changelog: parsed.options.changelogFile,
      design_note: parsed.options.designNote
    });
    const deliveryReadiness = evaluateTaskDeliveryReadiness(cwd, taskState, {
      deliveryPolicy: normalizeDeliveryPolicy(projectConfig?.delivery_policy),
      reportPolicy,
      reportWillBeGenerated: true
    });
    const report = buildReport(cwd, taskState, parsed.options, outputArtifacts, deliveryReadiness);
    validateReportAgainstPolicy(report, reportPolicy);
    writeReport(cwd, report, reportPolicy);

    updateTaskState(cwd, taskId, {
      current_phase: "close",
      current_state: "done"
    });

    console.log(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function parseReportArgs(argv) {
  const options = {
    adr: null,
    actualScope: [],
    changelogFile: null,
    conclusion: null,
    designNote: null,
    nextSteps: [],
    remainingRisks: [],
    scopeDeviation: null,
    taskId: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--task-id") {
      options.taskId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--conclusion") {
      options.conclusion = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--changelog-file") {
      options.changelogFile = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--design-note") {
      options.designNote = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--adr") {
      options.adr = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--actual-scope") {
      options.actualScope.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--scope-deviation") {
      options.scopeDeviation = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--risk") {
      options.remainingRisks.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--next-step") {
      options.nextSteps.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  if (!options.conclusion) {
    return { ok: false, error: "需要 --conclusion 参数" };
  }

  return { ok: true, options };
}

function buildReport(cwd, taskState, options, outputArtifacts, deliveryReadiness) {
  const contract = taskState.confirmed_contract ?? {};
  const draft = taskState.task_draft ?? {};
  const evidence = Array.isArray(taskState.evidence) ? taskState.evidence : [];
  const auditEntries = readAuditEntries(cwd, taskState.task_id);

  return {
    schema_version: SCHEMA_VERSION,
    task_id: taskState.task_id,
    intent: contract.intent ?? draft.intent ?? "unknown",
    conclusion: options.conclusion,
    actual_scope: options.actualScope.length > 0 ? options.actualScope : (contract.scope ?? draft.scope ?? []),
    scope_deviation: options.scopeDeviation ?? null,
    evidence_summary: evidence.map((item) => {
      const summary = {
        type: item.type,
        result: item.content
      };

      if (typeof item.passed === "boolean") {
        summary.passed = item.passed;
      }

      return summary;
    }),
    remaining_risks: options.remainingRisks,
    overrides_used: auditEntries
      .filter((entry) => entry.event_type === "force_override" || entry.event_type === "manual_confirmation")
      .map((entry) => entry.description),
    output_artifacts: outputArtifacts,
    delivery_readiness: deliveryReadiness,
    next_steps: options.nextSteps,
    completed_at: new Date().toISOString()
  };
}

function validateReportAgainstPolicy(report, reportPolicy) {
  if (reportPolicy.format !== "json") {
    throw new Error(`当前仅支持 json 报告格式，收到: ${reportPolicy.format}`);
  }

  const missingSections = [];
  for (const section of reportPolicy.required_sections) {
    if (!isReportSectionSatisfied(report, section)) {
      missingSections.push(section);
    }
  }

  if (missingSections.length > 0) {
    throw new Error(`报告缺少必需 section: ${missingSections.join(", ")}`);
  }
}

function isReportSectionSatisfied(report, section) {
  if (section === "task_conclusion") {
    return typeof report.conclusion === "string" && report.conclusion.trim().length > 0;
  }
  if (section === "actual_scope") {
    return Array.isArray(report.actual_scope) && report.actual_scope.length > 0;
  }
  if (section === "verification_evidence") {
    return Array.isArray(report.evidence_summary) && report.evidence_summary.length > 0;
  }
  if (section === "remaining_risks") {
    return Array.isArray(report.remaining_risks);
  }
  if (section === "next_steps") {
    return Array.isArray(report.next_steps);
  }

  throw new Error(`未知的 output_policy.report.required_sections 配置项: ${section}`);
}

function writeReport(cwd, report, reportPolicy) {
  const reportsDir = path.join(cwd, reportPolicy.directory);
  fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, `${report.task_id}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
