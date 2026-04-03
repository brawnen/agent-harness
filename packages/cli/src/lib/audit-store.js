import fs from "node:fs";
import path from "node:path";

const AUDIT_DIR = path.join("harness", "audit");
const VALID_EVENT_TYPES = [
  "force_override",
  "gate_violation",
  "remediation",
  "state_recovery",
  "manual_confirmation"
];
const VALID_PHASES = ["intake", "clarify", "plan", "execute", "verify", "report", "close"];
const VALID_RISK_LEVELS = ["low", "medium", "high", "unknown"];

export function appendAuditEntry(cwd, entry) {
  validateEntry(entry);

  const nextEntry = {
    event_type: entry.event_type,
    task_id: entry.task_id,
    phase: entry.phase,
    signal: entry.signal,
    description: entry.description,
    user_input: entry.user_input ?? null,
    risk_at_time: entry.risk_at_time ?? "unknown",
    timestamp: entry.timestamp ?? new Date().toISOString()
  };

  const auditDir = path.join(cwd, AUDIT_DIR);
  fs.mkdirSync(auditDir, { recursive: true });
  const filePath = path.join(auditDir, `${entry.task_id}.jsonl`);
  fs.appendFileSync(filePath, `${JSON.stringify(nextEntry)}\n`, "utf8");
  return nextEntry;
}

export function readAuditEntries(cwd, taskId) {
  const filePath = path.join(cwd, AUDIT_DIR, `${taskId}.jsonl`);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function validateEntry(entry) {
  if (!VALID_EVENT_TYPES.includes(entry.event_type)) {
    throw new Error(`无效的 event_type: ${entry.event_type}`);
  }

  if (!VALID_PHASES.includes(entry.phase)) {
    throw new Error(`无效的 phase: ${entry.phase}`);
  }

  const riskLevel = entry.risk_at_time ?? "unknown";
  if (!VALID_RISK_LEVELS.includes(riskLevel)) {
    throw new Error(`无效的 risk_at_time: ${riskLevel}`);
  }

  if (!entry.task_id) {
    throw new Error("缺少 task_id");
  }

  if (!entry.signal) {
    throw new Error("缺少 signal");
  }

  if (!entry.description) {
    throw new Error("缺少 description");
  }
}
