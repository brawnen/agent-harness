import fs from "node:fs";
import path from "node:path";

import { resolveTaskId, requireTaskState } from "../lib/state-store.js";

const VERIFICATION_MATRIX = {
  bug: {
    description: "至少一条命令或测试证明问题不再复现",
    deterministic: true,
    requiredTypes: ["command_result", "test_result"]
  },
  feature: {
    description: "至少一条命令或验证动作证明新能力可运行",
    deterministic: true,
    requiredTypes: ["command_result"]
  },
  refactor: {
    description: "至少一条测试证明行为未破坏",
    deterministic: true,
    requiredTypes: ["test_result"]
  },
  explore: {
    description: "至少有结论、依据、风险与下一步建议",
    deterministic: false,
    requiredTypes: ["reasoning_note"]
  },
  prototype: {
    description: "可无强制验证，但必须明确未验证范围",
    deterministic: false,
    requiredTypes: ["reasoning_note"]
  }
};

export function runVerify(argv) {
  const parsed = parseVerifyArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  let taskState;
  try {
    const taskId = parsed.options.taskFile
      ? null
      : resolveTaskId(process.cwd(), parsed.options.taskId);
    taskState = parsed.options.taskFile
      ? readTaskFile(process.cwd(), parsed.options.taskFile)
      : requireTaskState(process.cwd(), taskId);
  } catch (error) {
    console.error(error.message);
    return 1;
  }

  const result = verifyTaskState(taskState);
  console.log(`${JSON.stringify(result, null, 2)}\n`);
  return result.allowed ? 0 : 1;
}

function parseVerifyArgs(argv) {
  const options = {
    taskFile: null,
    taskId: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--task-id") {
      const value = argv[index + 1];
      if (!value) {
        return { ok: false, error: "缺少 --task-id 参数值" };
      }
      options.taskId = value;
      index += 1;
      continue;
    }

    if (arg === "--task-file") {
      const value = argv[index + 1];
      if (!value) {
        return { ok: false, error: "缺少 --task-file 参数值" };
      }
      options.taskFile = value;
      index += 1;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  if (options.taskId && options.taskFile) {
    return { ok: false, error: "--task-id 与 --task-file 不能同时使用" };
  }

  return { ok: true, options };
}

export function verifyTaskState(taskState) {
  const intent = taskState?.confirmed_contract?.intent ?? taskState?.task_draft?.intent ?? "unknown";
  const acceptance = taskState?.confirmed_contract?.acceptance ?? taskState?.task_draft?.acceptance ?? [];
  const evidence = Array.isArray(taskState?.evidence) ? taskState.evidence : [];
  const openQuestions = Array.isArray(taskState?.open_questions) ? taskState.open_questions : [];
  const missingEvidence = [];

  if (openQuestions.length > 0) {
    missingEvidence.push(`存在未关闭的阻断问题: ${openQuestions[0]}`);
  }

  const matrix = VERIFICATION_MATRIX[intent];
  if (!matrix) {
    missingEvidence.push(`未知的 intent 类型: ${intent}，无法匹配验证矩阵`);
  } else {
    const hasRequired = matrix.requiredTypes.some((type) => evidence.some((item) => item.type === type));
    if (!hasRequired) {
      missingEvidence.push(`${matrix.description}（需要: ${matrix.requiredTypes.join(" 或 ")}）`);
    }

    if (matrix.deterministic) {
      const deterministicEvidence = evidence.filter((item) => matrix.requiredTypes.includes(item.type));
      const allFailed =
        deterministicEvidence.length > 0 &&
        deterministicEvidence.every((item) => item.passed === false || (typeof item.exit_code === "number" && item.exit_code !== 0));

      if (allFailed) {
        missingEvidence.push("已有验证结果但全部失败");
      }
    }
  }

  if (!Array.isArray(acceptance) || acceptance.length === 0) {
    missingEvidence.push("未定义 acceptance 标准");
  }

  return {
    allowed: missingEvidence.length === 0,
    intent,
    missing_evidence: missingEvidence,
    signal: missingEvidence.length === 0 ? "allow_completion" : "block_completion",
    task_id: taskState.task_id ?? null
  };
}

function readTaskFile(cwd, taskFile) {
  const filePath = path.resolve(cwd, taskFile);
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(`JSON 解析失败: ${filePath}`);
  }
}
