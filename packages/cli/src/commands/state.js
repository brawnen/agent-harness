import fs from "node:fs";

import {
  getActiveTask,
  getTaskState,
  initTaskState,
  loadStateIndex,
  resolveTaskId,
  updateTaskState
} from "../lib/state-store.js";

export function runState(argv) {
  const [subcommand, ...rest] = argv;

  if (!subcommand) {
    console.error("缺少 state 子命令。可用: init, get, update, active");
    return 1;
  }

  if (subcommand === "init") {
    return runStateInit(rest);
  }

  if (subcommand === "get") {
    return runStateGet(rest);
  }

  if (subcommand === "update") {
    return runStateUpdate(rest);
  }

  if (subcommand === "active") {
    return runStateActive(rest);
  }

  console.error(`未知 state 子命令: ${subcommand}。可用: init, get, update, active`);
  return 1;
}

function runStateInit(argv) {
  const parsed = parseStateInitArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  try {
    const taskDraft = loadDraft(parsed.options);
    const result = initTaskState(process.cwd(), {
      taskDraft,
      taskId: parsed.options.taskId
    });
    printJson(result);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function runStateGet(argv) {
  const parsed = parseTaskIdArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  try {
    const taskId = resolveTaskId(process.cwd(), parsed.options.taskId);
    const result = getTaskState(process.cwd(), taskId);
    if (!result) {
      console.error(`任务不存在: ${taskId}`);
      return 1;
    }

    printJson(result);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function runStateUpdate(argv) {
  const parsed = parseStateUpdateArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  try {
    const taskId = resolveTaskId(process.cwd(), parsed.options.taskId);
    const changes = {};

    if (parsed.options.phase) {
      changes.current_phase = parsed.options.phase;
    }
    if (parsed.options.state) {
      changes.current_state = parsed.options.state;
    }
    if (parsed.options.evidence) {
      changes.evidence = [JSON.parse(parsed.options.evidence)];
    } else if (parsed.options.tool) {
      changes.evidence = [{
        type: "command_result",
        content: `Tool: ${parsed.options.tool}`,
        exit_code: parsed.options.exitCode ?? 0,
        timestamp: new Date().toISOString()
      }];
    }

    const result = updateTaskState(process.cwd(), taskId, changes);
    printJson(result);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function runStateActive(argv) {
  if (argv.length > 0) {
    console.error(`state active 不接受额外参数: ${argv.join(" ")}`);
    return 1;
  }

  try {
    const result = getActiveTask(process.cwd());
    if (!result) {
      const index = loadStateIndex(process.cwd());
      if (!index.active_task_id) {
        console.error("当前无活跃任务");
        return 1;
      }
    }

    printJson(result);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function parseStateInitArgs(argv) {
  const options = {
    draft: null,
    draftFile: null,
    taskId: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--draft") {
      options.draft = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--draft-file") {
      options.draftFile = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--task-id") {
      options.taskId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  if (!options.draft && !options.draftFile) {
    return { ok: false, error: "需要 --draft 或 --draft-file 参数" };
  }

  if (options.draft && options.draftFile) {
    return { ok: false, error: "--draft 与 --draft-file 不能同时使用" };
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

function parseStateUpdateArgs(argv) {
  const options = {
    evidence: null,
    exitCode: null,
    phase: null,
    state: null,
    taskId: null,
    tool: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--task-id") {
      options.taskId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--tool") {
      options.tool = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--exit-code") {
      const value = argv[index + 1];
      options.exitCode = value == null ? null : Number(value);
      index += 1;
      continue;
    }

    if (arg === "--phase") {
      options.phase = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--state") {
      options.state = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--evidence") {
      options.evidence = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  return { ok: true, options };
}

function loadDraft(options) {
  if (options.draft) {
    return JSON.parse(options.draft);
  }

  try {
    return JSON.parse(fs.readFileSync(options.draftFile, "utf8"));
  } catch {
    throw new Error(`无法读取 task draft: ${options.draftFile}`);
  }
}

function printJson(value) {
  console.log(`${JSON.stringify(value, null, 2)}\n`);
}
