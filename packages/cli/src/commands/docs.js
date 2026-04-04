import fs from "node:fs";
import path from "node:path";

import { normalizeOutputPolicy } from "../lib/output-policy.js";
import { loadProjectConfig } from "../lib/project-config.js";
import { requireTaskState, resolveTaskId } from "../lib/state-store.js";

const VALID_TYPES = new Set(["design-note", "adr"]);

export function runDocs(argv) {
  const [subcommand, ...rest] = argv;

  if (!subcommand) {
    console.error("缺少 docs 子命令。可用: scaffold");
    return 1;
  }

  if (subcommand === "scaffold") {
    return runDocsScaffold(rest);
  }

  console.error(`未知 docs 子命令: ${subcommand}。可用: scaffold`);
  return 1;
}

function runDocsScaffold(argv) {
  const parsed = parseDocsScaffoldArgs(argv);
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
    const plan = buildScaffoldPlan(cwd, taskState, outputPolicy, parsed.options);

    if (!parsed.options.force && fs.existsSync(plan.absolutePath)) {
      throw new Error(`文档已存在，请使用 --force 覆盖: ${plan.relativePath}`);
    }

    fs.mkdirSync(path.dirname(plan.absolutePath), { recursive: true });
    fs.writeFileSync(plan.absolutePath, plan.content, "utf8");

    console.log(`${JSON.stringify({
      task_id: taskId,
      type: parsed.options.type,
      path: plan.relativePath,
      title: plan.title
    }, null, 2)}\n`);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function parseDocsScaffoldArgs(argv) {
  const options = {
    force: false,
    path: null,
    taskId: null,
    title: null,
    type: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--task-id") {
      options.taskId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--type") {
      const value = argv[index + 1] ?? null;
      if (!VALID_TYPES.has(value)) {
        return { ok: false, error: "无效的 --type 参数。可选值: design-note, adr" };
      }
      options.type = value;
      index += 1;
      continue;
    }
    if (arg === "--path") {
      options.path = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--title") {
      options.title = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  if (!options.type) {
    return { ok: false, error: "需要 --type 参数。可选值: design-note, adr" };
  }

  return { ok: true, options };
}

function buildScaffoldPlan(cwd, taskState, outputPolicy, options) {
  const context = buildTaskContext(taskState);
  const relativePath = options.path ?? buildDefaultDocPath(options.type, taskState.task_id, context, outputPolicy);
  const absolutePath = path.join(cwd, relativePath);
  const title = options.title ?? buildDefaultTitle(options.type, context.goal);
  const content = buildTemplate(options.type, title, context);

  return {
    title,
    relativePath,
    absolutePath,
    content
  };
}

function buildDefaultDocPath(type, taskId, context, outputPolicy) {
  const directory = type === "design-note"
    ? outputPolicy.design_note.directory
    : outputPolicy.adr.directory;
  const datePrefix = new Date().toISOString().slice(0, 10);
  const slug = slugify(taskId || context.goal || type);
  const suffix = type === "design-note" ? "design-note" : "adr";
  return path.posix.join(directory.replace(/\\/g, "/"), `${datePrefix}-${slug}-${suffix}.md`);
}

function buildDefaultTitle(type, goal) {
  const normalizedGoal = String(goal ?? "").trim();
  if (!normalizedGoal) {
    return type === "design-note" ? "Design Note" : "ADR";
  }
  return type === "design-note"
    ? `Design Note: ${normalizedGoal}`
    : `ADR: ${normalizedGoal}`;
}

function buildTemplate(type, title, context) {
  if (type === "adr") {
    return buildAdrTemplate(title, context);
  }
  return buildDesignNoteTemplate(title, context);
}

function buildDesignNoteTemplate(title, context) {
  return [
    `# ${title}`,
    "",
    "## 背景",
    "",
    `- task_id: \`${context.task_id}\``,
    `- intent: \`${context.intent}\``,
    `- risk_level: \`${context.risk_level}\``,
    "",
    "## 目标",
    "",
    context.goal ? `- ${context.goal}` : "- 待补充",
    "",
    "## 作用范围",
    "",
    ...toBulletLines(context.scope),
    "",
    "## 方案",
    "",
    "- 待补充",
    "",
    "## 风险与权衡",
    "",
    "- 待补充",
    "",
    "## 验证计划",
    "",
    "- 待补充",
    ""
  ].join("\n");
}

function buildAdrTemplate(title, context) {
  return [
    `# ${title}`,
    "",
    "## 状态",
    "",
    "Proposed",
    "",
    "## 背景",
    "",
    `- task_id: \`${context.task_id}\``,
    `- intent: \`${context.intent}\``,
    `- risk_level: \`${context.risk_level}\``,
    context.goal ? `- goal: ${context.goal}` : "- goal: 待补充",
    "",
    "## 决策",
    "",
    "- 待补充",
    "",
    "## 后果",
    "",
    "- 正面影响：待补充",
    "- 代价与风险：待补充",
    "",
    "## 影响范围",
    "",
    ...toBulletLines(context.scope),
    ""
  ].join("\n");
}

function buildTaskContext(taskState) {
  const contract = taskState?.confirmed_contract ?? {};
  const draft = taskState?.task_draft ?? {};
  return {
    task_id: taskState?.task_id ?? "",
    goal: String(contract.goal ?? draft.goal ?? "").trim(),
    intent: String(contract.intent ?? draft.intent ?? "unknown"),
    risk_level: String(contract.risk_level ?? draft?.derived?.risk_level ?? "medium"),
    scope: normalizeStringArray(contract.scope ?? draft.scope)
  };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function toBulletLines(items) {
  if (items.length === 0) {
    return ["- 待补充"];
  }
  return items.map((item) => `- ${item}`);
}

function slugify(value) {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "task";
}
