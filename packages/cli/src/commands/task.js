import { createTaskFromInput, suspendActiveTask } from "../lib/task-core.js";
import { normalizeOutputPolicy } from "../lib/output-policy.js";
import { loadProjectConfig } from "../lib/project-config.js";
import { confirmTaskContract, resolveTaskId, updateTaskState } from "../lib/state-store.js";
import { evaluateTaskWorkflowDecision, normalizeWorkflowPolicy } from "../lib/workflow-policy.js";

export function runTask(argv) {
  const [subcommand, ...rest] = argv;

  if (!subcommand) {
    console.error("缺少 task 子命令。可用: intake, suspend-active");
    return 1;
  }

  if (subcommand === "intake") {
    return runTaskIntake(rest);
  }

  if (subcommand === "confirm" || subcommand === "confirm-contract") {
    return runTaskConfirm(rest);
  }

  if (subcommand === "suspend-active" || subcommand === "suspend-active-task") {
    return runTaskSuspendActive(rest);
  }

  console.error(`未知 task 子命令: ${subcommand}。可用: intake, confirm, suspend-active`);
  return 1;
}

function runTaskIntake(argv) {
  const parsed = parseTaskIntakeArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  try {
    const result = createTaskFromInput(process.cwd(), parsed.options.input, parsed.options);
    printJson(result);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function runTaskSuspendActive(argv) {
  const parsed = parseTaskSuspendArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  try {
    const result = suspendActiveTask(process.cwd(), {
      reason: parsed.options.reason,
      clearActive: true
    });
    printJson(result);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function runTaskConfirm(argv) {
  const parsed = parseTaskConfirmArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  try {
    const cwd = process.cwd();
    const taskId = resolveTaskId(cwd, parsed.options.taskId);
    const confirmed = confirmTaskContract(cwd, taskId, parsed.options);
    const projectConfig = loadProjectConfig(cwd);
    const workflowDecision = evaluateTaskWorkflowDecision(confirmed, {
      workflowPolicy: normalizeWorkflowPolicy(projectConfig?.workflow_policy),
      outputPolicy: normalizeOutputPolicy(projectConfig?.output_policy),
      previousDecision: confirmed.workflow_decision
    });
    const result = updateTaskState(cwd, taskId, {
      workflow_decision: workflowDecision
    });
    printJson(result);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function parseTaskIntakeArgs(argv) {
  const options = {
    acceptance: [],
    assumptions: [],
    constraints: [],
    contextRefs: [],
    goal: null,
    input: null,
    intent: null,
    mode: null,
    scope: [],
    suspendActive: false,
    suspendReason: null,
    taskId: null,
    title: null
  };

  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    if (arg === "--input") {
      options.input = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--intent") {
      options.intent = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--goal") {
      options.goal = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--scope") {
      options.scope.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--acceptance") {
      options.acceptance.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--constraint") {
      options.constraints.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--assumption") {
      options.assumptions.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--context-ref") {
      options.contextRefs.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--mode") {
      options.mode = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--task-id") {
      options.taskId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--title") {
      options.title = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--suspend-active") {
      options.suspendActive = true;
      continue;
    }
    if (arg === "--suspend-reason") {
      options.suspendReason = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  if (!options.input && positional.length > 0) {
    options.input = positional.join(" ");
  }

  if (!options.input) {
    return { ok: false, error: "需要任务描述。用法: task intake \"<任务描述>\" 或 --input" };
  }

  return { ok: true, options };
}

function parseTaskSuspendArgs(argv) {
  const options = {
    reason: "用户显式要求挂起当前活跃任务。"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--reason") {
      options.reason = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  return { ok: true, options };
}

function parseTaskConfirmArgs(argv) {
  const options = {
    acceptance: [],
    constraints: [],
    contextRefs: [],
    evidenceRequired: [],
    goal: null,
    id: null,
    intent: null,
    mode: null,
    riskLevel: null,
    scope: [],
    taskId: null,
    title: null,
    verification: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--task-id") {
      options.taskId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--intent") {
      options.intent = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--goal") {
      options.goal = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--scope") {
      options.scope.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--acceptance") {
      options.acceptance.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--constraint") {
      options.constraints.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--context-ref") {
      options.contextRefs.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--verification") {
      options.verification.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--evidence-required") {
      options.evidenceRequired.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--mode") {
      options.mode = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--title") {
      options.title = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--id") {
      options.id = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--risk-level") {
      options.riskLevel = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  return { ok: true, options };
}

function printJson(value) {
  console.log(`${JSON.stringify(value, null, 2)}\n`);
}
