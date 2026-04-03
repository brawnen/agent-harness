import fs from "node:fs";
import path from "node:path";

import { readAuditEntries } from "../lib/audit-store.js";
import { requireTaskState, resolveTaskId, updateTaskState } from "../lib/state-store.js";
import { verifyTaskState } from "./verify.js";

const SCHEMA_VERSION = "0.2";

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
    const verification = verifyTaskState(taskState);

    if (!verification.allowed) {
      console.log(`${JSON.stringify(verification, null, 2)}\n`);
      return 1;
    }

    const report = buildReport(cwd, taskState, parsed.options);
    writeReport(cwd, report);

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
    actualScope: [],
    conclusion: null,
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

function buildReport(cwd, taskState, options) {
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
    next_steps: options.nextSteps,
    completed_at: new Date().toISOString()
  };
}

function writeReport(cwd, report) {
  const reportsDir = path.join(cwd, "harness", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, `${report.task_id}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
