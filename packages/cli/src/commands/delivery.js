import { evaluateTaskDeliveryReadiness, normalizeDeliveryPolicy } from "../lib/delivery-policy.js";
import { normalizeOutputPolicy } from "../lib/output-policy.js";
import { loadProjectConfig } from "../lib/project-config.js";
import { requireTaskState, resolveTaskId } from "../lib/state-store.js";

const VALID_ACTIONS = new Set(["commit", "push"]);

export function runDelivery(argv) {
  const [subcommand, ...rest] = argv;

  if (!subcommand) {
    console.error("缺少 delivery 子命令。可用: ready, request");
    return 1;
  }

  if (subcommand === "ready") {
    return runDeliveryReady(rest);
  }

  if (subcommand === "request") {
    return runDeliveryRequest(rest);
  }

  console.error(`未知 delivery 子命令: ${subcommand}。可用: ready, request`);
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
      delivery_readiness: readiness
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
      requested_at: new Date().toISOString()
    };

    printJson(result);
    return result.allowed ? 0 : 1;
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
