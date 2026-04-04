import { appendAuditEntry, readAuditEntries } from "../lib/audit-store.js";

export function runAudit(argv) {
  const [subcommand, ...rest] = argv;

  if (subcommand === "append") {
    return runAuditAppend(rest);
  }

  if (subcommand === "read") {
    return runAuditRead(rest);
  }

  console.error("audit 可用子命令: append, read");
  return 1;
}

function runAuditAppend(argv) {
  const parsed = parseAppendArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  try {
    const entry = appendAuditEntry(process.cwd(), parsed.options);
    printJson(entry);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function runAuditRead(argv) {
  const parsed = parseReadArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  try {
    const entries = readAuditEntries(process.cwd(), parsed.options.taskId);
    printJson({
      schema_version: "0.3",
      entries
    });
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function parseAppendArgs(argv) {
  const options = {
    description: null,
    event_type: null,
    phase: null,
    risk_at_time: "unknown",
    signal: null,
    task_id: null,
    user_input: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (Object.hasOwn(FLAG_MAP, arg)) {
      const key = FLAG_MAP[arg];
      options[key] = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  if (!options.task_id || !options.event_type || !options.phase || !options.signal || !options.description) {
    return { ok: false, error: "需要 --task-id --event-type --phase --signal --description 参数" };
  }

  return { ok: true, options };
}

function parseReadArgs(argv) {
  const taskIdFlagIndex = argv.indexOf("--task-id");
  if (taskIdFlagIndex < 0 || !argv[taskIdFlagIndex + 1]) {
    return { ok: false, error: "需要 --task-id 参数" };
  }

  if (argv.length !== 2) {
    return { ok: false, error: "audit read 仅支持 --task-id <id>" };
  }

  return { ok: true, options: { taskId: argv[taskIdFlagIndex + 1] } };
}

function printJson(value) {
  console.log(`${JSON.stringify(value, null, 2)}\n`);
}

const FLAG_MAP = {
  "--description": "description",
  "--event-type": "event_type",
  "--phase": "phase",
  "--risk-at-time": "risk_at_time",
  "--signal": "signal",
  "--task-id": "task_id",
  "--user-input": "user_input"
};
