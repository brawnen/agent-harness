import { runAudit } from "./commands/audit.js";
import { runDelivery } from "./commands/delivery.js";
import { runDocs } from "./commands/docs.js";
import { runGate } from "./commands/gate.js";
import { runInit } from "./commands/init.js";
import { runReport } from "./commands/report.js";
import { runState } from "./commands/state.js";
import { runStatus } from "./commands/status.js";
import { runTask } from "./commands/task.js";
import { runVerify } from "./commands/verify.js";

const HELP_TEXT = `agent-harness CLI

Usage:
  agent-harness --help
  agent-harness --version
  agent-harness init
  agent-harness init --dry-run
  agent-harness init --protocol-only
  agent-harness audit <append|read>
  agent-harness delivery <ready|request|commit>
  agent-harness docs scaffold --type <design-note|adr>
  agent-harness gate before-tool --tool <tool>
  agent-harness status
  agent-harness task intake "<任务描述>"
  agent-harness task confirm [--task-id <task-id>]
  agent-harness task suspend-active
  agent-harness state <init|get|update|active>
  agent-harness verify
  agent-harness verify --task-id <task-id>
  agent-harness report --conclusion <text>

Options:
  --host <auto|claude-code|codex|gemini-cli>
  --rules <base|full>
  --mode <delivery|explore|poc>
  --dry-run
  --protocol-only
  --force

Status:
  task/init/status/state/verify/report/gate/audit/delivery/docs MVP are implemented.
`;

export function run(argv) {
  const [command] = argv;

  if (!command || command === "--help" || command === "-h") {
    console.log(HELP_TEXT);
    return 0;
  }

  if (command === "--version" || command === "-v") {
    console.log("0.1.0");
    return 0;
  }

  if (command === "init") {
    return runInit(argv.slice(1));
  }

  if (command === "audit") {
    return runAudit(argv.slice(1));
  }

  if (command === "delivery") {
    return runDelivery(argv.slice(1));
  }

  if (command === "docs") {
    return runDocs(argv.slice(1));
  }

  if (command === "gate") {
    return runGate(argv.slice(1));
  }

  if (command === "status") {
    return runStatus(argv.slice(1));
  }

  if (command === "task") {
    return runTask(argv.slice(1));
  }

  if (command === "state") {
    return runState(argv.slice(1));
  }

  if (command === "verify") {
    return runVerify(argv.slice(1));
  }

  if (command === "report") {
    return runReport(argv.slice(1));
  }

  console.error(`未知命令: ${command}`);
  console.error("运行 `agent-harness --help` 查看可用命令。");
  return 1;
}
