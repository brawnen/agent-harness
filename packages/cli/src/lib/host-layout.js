import fs from "node:fs";
import path from "node:path";

export const HOST_LAYOUT_VERSION = "0.1.1";
export const HOST_LAYOUT_RULES_MODE = "converged";

export const HOST_LAYOUT_HOSTS = ["codex", "claude-code", "gemini-cli"];

const SOURCE_ROOT = path.posix.join(".harness");
const HOSTS_ROOT = path.posix.join(SOURCE_ROOT, "hosts");
const RULES_ROOT = path.posix.join(SOURCE_ROOT, "rules");
const GENERATED_ROOT = path.posix.join(SOURCE_ROOT, "generated");

const RULE_TARGETS = {
  codex: "AGENTS.md",
  "claude-code": "CLAUDE.md",
  "gemini-cli": "GEMINI.md"
};

const COPY_TARGETS = {
  codex: [
    { source: path.posix.join(HOSTS_ROOT, "codex", "config.toml"), target: ".codex/config.toml" },
    { source: path.posix.join(HOSTS_ROOT, "codex", "hooks.json"), target: ".codex/hooks.json" }
  ],
  "claude-code": [
    { source: path.posix.join(HOSTS_ROOT, "claude", "settings.json"), target: ".claude/settings.json" }
  ],
  "gemini-cli": [
    { source: path.posix.join(HOSTS_ROOT, "gemini", "settings.json"), target: ".gemini/settings.json" }
  ]
};

const MANIFEST_TARGET = path.posix.join(GENERATED_ROOT, "manifest.json");

const DEFAULT_SHARED_RULES = `# Harness 任务收敛规则

本项目使用 Harness 协议约束 agent 行为。以下规则为强制执行项。

## Harness Intake 规则

每次收到新任务输入时，必须先在内部完成以下推断，再决定下一步动作：

- **intent**：bug / feature / explore / refactor / prototype
- **goal**：一句话描述要达成的结果
- **scope**：允许修改或分析的文件/模块边界
- **acceptance**：什么算完成（可执行的验收标准）
- **constraints**：不允许做的事（用户显式或隐式要求）
- **assumptions**：已采用但未经用户确认的假设

所有字段均从自然语言推断，不要求用户填写结构化表单。

推断完成后，根据字段完整性和风险信号决定 \`next_action\`：
- 所有必填字段已闭合且无阻断问题 → \`plan\`
- scope / acceptance 尚未闭合，但可先通过阅读代码、状态或上下文自行收敛时 → \`observe\`（只读）
- 输入只是当前任务内的简短回复 / 步骤选择时 → \`observe\`（只读）
- 只有存在真实阻断缺口时才 \`clarify\`

## Harness Clarify 规则

只在以下情况追问用户，且每次只问一个最高价值问题：

1. scope 不清，可能越过 protected_paths 或影响范围过大
2. acceptance 无法判断完成（模糊、矛盾或缺失）
3. 存在高成本路径分叉，需用户决策
4. 命中高风险区域（risk_level: high）
5. 任务依赖外部资源或权限，需确认可用性

禁止追问的情况：
- 可以通过阅读代码自行确认的技术细节
- 已有合理默认值的可选配置
- 与当前阻断无关的低优先级问题
- 低风险的任务归属不确定，且可以先按当前任务 \`observe\` 消化的情况

## Harness 执行门禁（L2）

以下情况**禁止**直接执行工具调用或修改文件：

1. intent / goal / scope / acceptance 尚未全部确定
2. 当前任务处于 \`needs_clarification\` 状态
3. 执行动作明显超出已确认的 scope
4. 命中高风险范围但未获得用户确认
5. 存在未处理的阻断问题（open_questions 非空且为阻断性）

违反执行门禁时的处理：
- 停止当前动作
- 说明被阻断的原因
- 给出需要用户确认或补充的内容

## Harness 完成门禁（L2）

以下情况**禁止**宣称任务完成：

| intent | 最低验证要求 |
|---|---|
| bug | 至少一条命令或测试证明问题不再复现 |
| feature | 至少一条命令或验证动作证明新能力可运行 |
| refactor | 至少一条测试证明行为未破坏 |
| explore | 必须给出结论、依据、风险与下一步建议 |
| prototype | 可无强制验证，但必须明确标注未验证范围 |

通用阻断条件：
- 必需 evidence 未产生
- acceptance 与实际结果不匹配
- 仍存在未关闭的阻断问题

## Harness Observe 规则

当 \`next_action\` 为 \`observe\` 时：

- 只允许只读动作：读文件、搜索代码、阅读日志
- 禁止修改文件、运行有副作用的命令
- observe 结束后必须更新内部任务理解，重新判断 next_action
- observe 的发现必须作为 reasoning_note 记录

## Harness Force Override 规则

用户可以显式要求跳过某个门禁（如"别问了直接做"、"跳过验证"）。

Override 允许跳过：
- clarify 追问
- 高风险确认提示
- 非强制验证要求

Override 不能跳过：
- protected_paths 写入限制
- 文件系统或平台硬权限限制

使用 override 时必须：
- 在输出中明确标注"已跳过 XXX 门禁"
- 记录被跳过的门禁、用户确认语句、当前风险等级

## Harness 交互输出格式

对外输出默认极简，内部状态继续严格维护。

- 默认只输出用户真正需要的信息：结论、必要原因、必要问题、必要验证
- 无阻断时，不要输出“阻断缺口：无”“下一步动作：plan”这类模板字段
- 需要用户决策时，只问一个最高价值问题
- 高风险时，简短说明风险和需要确认的点
- 只有用户明确要求细节时，才展开内部状态或完整推理

## Harness 多任务规则

- 新输入默认先判断是否属于当前活跃任务
- 若明显是新任务，新建任务并将当前任务挂起
- 若只是对上轮问题的回答、步骤选择或简短确认，默认视为当前任务续接
- 无法确定时，主动询问用户："你说的是刚才 XXX 的任务，还是一个新问题？"
- 切换任务前必须先保存当前任务状态

## 手动 fallback

当 hook 未启用、自动 intake 失败，或需要人工修正任务归属时，手动调用现有命令：

- 直接从自然语言创建任务：\`node packages/cli/bin/agent-harness.js task intake "任务描述"\`
- 挂起当前 active task：\`node packages/cli/bin/agent-harness.js task suspend-active --reason "原因"\`
- 任务初始化：准备 task draft JSON 后执行 \`node packages/cli/bin/agent-harness.js state init --draft-file <path>\`
- 查看当前活跃任务：\`node packages/cli/bin/agent-harness.js state active\`
- 查看指定任务状态：\`node packages/cli/bin/agent-harness.js state get --task-id <id>\`
- 任务完成前：\`node packages/cli/bin/agent-harness.js verify --task-id <id>\`
- 任务完成后：\`node packages/cli/bin/agent-harness.js report --task-id <id> --conclusion "结论"\`

状态文件位置：
- 任务状态：\`.harness/state/tasks/<task_id>.json\`
- 任务索引：\`.harness/state/index.json\`
- 审计日志：\`.harness/audit/<task_id>.jsonl\`
- 完成报告：\`.harness/reports/<task_id>.json\`

## 项目配置

- 配置文件：\`harness.yaml\`
- 任务模板：\`.harness/tasks/\` 下 bug.md / feature.md / explore.md
- 风险规则见 harness.yaml 中 risk_rules 部分
`;

const DEFAULT_RULE_DELTAS = {
  codex: `## Codex 宿主说明

> **注意**：当前项目通过根目录 \`.codex/config.toml\` 与 \`.codex/hooks.json\` 暴露 Codex 宿主入口，但真实源文件位于 \`.harness/hosts/codex/\`。即便有 hook，执行门禁仍不能只依赖 hook，本规则（L2）依旧有效。

### Codex 自动模式

当前项目已提供 repo-local Codex hooks：

- \`SessionStart\`：恢复 active task 摘要
- \`UserPromptSubmit\`：自动 intake / continue / clarify / override

当前默认只启用最小 hook 集合。工具级 \`PreToolUse / PostToolUse\` 虽保留实现，但默认关闭，以降低宿主前台噪音。

建议在当前仓库中使用：

- \`codex\`
- \`codex exec ...\`

若项目未被 Codex 视为 trusted project，仍可显式使用：

- \`codex --enable codex_hooks\`
- \`codex exec --enable codex_hooks ...\`
`,
  "claude-code": `## Claude Code 宿主说明

> **注意**：当前项目通过根目录 \`.claude/settings.json\` 暴露 Claude Code 宿主入口，但真实源文件位于 \`.harness/hosts/claude/\`。即便有 hook，执行门禁仍不能只依赖 hook，本规则（L2）依旧有效。

### Claude Code hook 接入

当前项目已提供：

- \`SessionStart\`
- \`UserPromptSubmit\`
- \`PreToolUse\`
- \`PostToolUse\`
- \`Stop\`

### Claude Code 宿主接入偏好

对于 \`Claude Code\` 宿主接入相关任务：

- 默认由 agent 自行完成方案、实现、验证与收口
- 不要在中途反复向用户确认实现细节
- 只有在高风险、超出已确认 scope、需要外部权限或不可逆操作时才追问用户
- 若存在普通实现分支，默认选择实现成本低、验证快、回滚简单的路径直接推进
`,
  "gemini-cli": `## Gemini CLI 宿主说明

> **注意**：当前项目通过根目录 \`.gemini/settings.json\` 暴露 Gemini CLI 宿主入口，但真实源文件位于 \`.harness/hosts/gemini/\`。即便有 hook，执行门禁仍不能只依赖 hook，本规则（L2）依旧有效。

### Gemini CLI hook 接入

当前项目已提供：

- \`SessionStart\`
- \`BeforeAgent\`
- \`BeforeTool\`
- \`AfterTool\`
- \`AfterAgent\`

### Gemini CLI 宿主接入偏好

对于 \`Gemini CLI\` 宿主接入相关任务：

- 默认由 agent 自行完成方案、实现、验证与收口
- 不要在中途反复向用户确认实现细节
- 只有在高风险、超出已确认 scope、需要外部权限或不可逆操作时才追问用户
- 若存在普通实现分支，默认选择实现成本低、验证快、回滚简单的路径直接推进
`
};

const DEFAULT_CLAUDE_SETTINGS = `{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "node \\"$CLAUDE_PROJECT_DIR/.harness/hosts/claude/hooks/session_start.js\\""
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \\"$CLAUDE_PROJECT_DIR/.harness/hosts/claude/hooks/user_prompt_submit.js\\""
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit|Bash|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node \\"$CLAUDE_PROJECT_DIR/.harness/hosts/claude/hooks/pre_tool_use.js\\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "node \\"$CLAUDE_PROJECT_DIR/.harness/hosts/claude/hooks/post_tool_use.js\\""
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \\"$CLAUDE_PROJECT_DIR/.harness/hosts/claude/hooks/stop.js\\""
          }
        ]
      }
    ]
  }
}
`;

const DEFAULT_GEMINI_SETTINGS = `{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \\"$(git rev-parse --show-toplevel)/.harness/hosts/gemini/hooks/session_start.js\\""
          }
        ]
      }
    ],
    "BeforeAgent": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \\"$(git rev-parse --show-toplevel)/.harness/hosts/gemini/hooks/before_agent.js\\""
          }
        ]
      }
    ],
    "BeforeTool": [
      {
        "matcher": "run_shell_command|write_file|replace",
        "hooks": [
          {
            "type": "command",
            "command": "node \\"$(git rev-parse --show-toplevel)/.harness/hosts/gemini/hooks/before_tool.js\\""
          }
        ]
      }
    ],
    "AfterTool": [
      {
        "matcher": "run_shell_command|write_file|replace",
        "hooks": [
          {
            "type": "command",
            "command": "node \\"$(git rev-parse --show-toplevel)/.harness/hosts/gemini/hooks/after_tool.js\\""
          }
        ]
      }
    ],
    "AfterAgent": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \\"$(git rev-parse --show-toplevel)/.harness/hosts/gemini/hooks/after_agent.js\\""
          }
        ]
      }
    ]
  }
}
`;

const DEFAULT_SHARED_PAYLOAD_IO = `import fs from "node:fs";

export function readHookPayload() {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("hook stdin 不是合法 JSON");
  }
}

export function resolvePayloadCwd(payload) {
  if (typeof payload?.cwd === "string" && payload.cwd.trim()) {
    return payload.cwd.trim();
  }

  return process.cwd();
}

export function resolvePayloadPrompt(payload) {
  if (typeof payload?.prompt === "string" && payload.prompt.trim()) {
    return payload.prompt.trim();
  }

  if (typeof payload?.user_prompt === "string" && payload.user_prompt.trim()) {
    return payload.user_prompt.trim();
  }

  return "";
}

export function firstString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

export function firstDefined(values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return null;
}

export function writeHookOutput(result) {
  process.stdout.write(\`\${JSON.stringify(result, null, 2)}\\n\`);
}
`;

const DEFAULT_SHARED_RUNTIME_LOADER = `import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

const RUNTIME_MODULES = {
  "runtime-host": {
    monorepoPath: ["packages", "cli", "src", "runtime-host", "index.js"],
    packageFilePath: ["node_modules", "@brawnen", "agent-harness-cli", "src", "runtime-host", "index.js"],
    packageSpecifier: "@brawnen/agent-harness-cli/runtime-host"
  }
};

export async function importRuntimeModule(moduleName, cwd = process.cwd()) {
  const definition = RUNTIME_MODULES[String(moduleName ?? "").trim()];
  if (!definition) {
    throw new Error(\`未知 runtime 模块：\${moduleName}\`);
  }

  const repoRoot = resolveRepoRoot(cwd);
  const candidates = [
    path.join(repoRoot, ...definition.monorepoPath),
    path.join(repoRoot, ...definition.packageFilePath)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return import(pathToFileURL(candidate).href);
    }
  }

  try {
    const resolved = require.resolve(definition.packageSpecifier, {
      paths: [repoRoot]
    });
    return import(pathToFileURL(resolved).href);
  } catch {
    throw new Error(
      \`无法解析 agent-harness runtime 模块：\${moduleName}。请确认目标仓库已安装 @brawnen/agent-harness-cli，或当前在 agent-harness monorepo 内执行。\`
    );
  }
}

export async function importCliModule(moduleRelativePath, cwd = process.cwd()) {
  const repoRoot = resolveRepoRoot(cwd);
  const normalizedPath = String(moduleRelativePath ?? "").replace(/^[/\\\\]+/, "");
  const candidates = [
    path.join(repoRoot, "packages", "cli", normalizedPath),
    path.join(repoRoot, "node_modules", "@brawnen", "agent-harness-cli", normalizedPath)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return import(pathToFileURL(candidate).href);
    }
  }

  try {
    const resolved = require.resolve(\`@brawnen/agent-harness-cli/\${toPosixPath(normalizedPath)}\`, {
      paths: [repoRoot]
    });
    return import(pathToFileURL(resolved).href);
  } catch {
    throw new Error(
      \`无法解析 agent-harness runtime 模块：\${normalizedPath}。请确认目标仓库已安装 @brawnen/agent-harness-cli，或当前在 agent-harness monorepo 内执行。\`
    );
  }
}

function resolveRepoRoot(cwd) {
  let current = path.resolve(cwd);

  while (true) {
    if (
      fs.existsSync(path.join(current, "harness.yaml")) ||
      fs.existsSync(path.join(current, ".harness")) ||
      fs.existsSync(path.join(current, ".git"))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(cwd);
    }
    current = parent;
  }
}

function toPosixPath(value) {
  return value.split(path.sep).join(path.posix.sep);
}
`;

const DEFAULT_CODEX_CONFIG = `[features]
codex_hooks = true
`;

const DEFAULT_CODEX_HOOKS_JSON = `{
  "$comment": "Repo-local Codex hooks generated from .harness/hosts/codex.",
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \\"$(git rev-parse --show-toplevel)/.harness/hosts/codex/hooks/user_prompt_submit_intake.js\\" || echo \\"{}\\""
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "node \\"$(git rev-parse --show-toplevel)/.harness/hosts/codex/hooks/session_start_restore.js\\" || echo \\"{}\\""
          }
        ]
      }
    ]
  }
}
`;

const DEFAULT_CODEX_USER_PROMPT = `import { invokeAgentHarnessCodexHook, readHookPayload, writeContinue } from "./shared/codex-hook-io.js";

try {
  const payload = readHookPayload();
  process.stdout.write(\`\${JSON.stringify(await invokeAgentHarnessCodexHook("user-prompt-submit", payload), null, 2)}\\n\`);
} catch (error) {
  await writeContinue("UserPromptSubmit", \`Codex UserPromptSubmit hook 执行失败：\${error.message}\`);
}
`;

const DEFAULT_CLAUDE_SESSION_START = `import { readHookPayload, resolvePayloadCwd, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

const FALLBACK_COMMANDS = [
  "npx @brawnen/agent-harness-cli state active",
  "npx @brawnen/agent-harness-cli task intake \\"任务描述\\""
];

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handleSessionStart, buildClaudeHookOutput } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildClaudeHookOutput("SessionStart", handleSessionStart({
    cwd,
    fallbackCommands: FALLBACK_COMMANDS,
    hostDisplayName: "Claude Code",
    source: payload?.source ?? ""
  })));
} catch (error) {
  const { buildClaudeHookOutput } = await importRuntimeModule("runtime-host");
  writeHookOutput(buildClaudeHookOutput("SessionStart", {
    additionalContext: \`Claude Code SessionStart hook 执行失败：\${error.message}\`,
    status: "continue"
  }));
}
`;

const DEFAULT_CLAUDE_USER_PROMPT = `import { readHookPayload, resolvePayloadCwd, resolvePayloadPrompt, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

const FALLBACK_COMMANDS = [
  "npx @brawnen/agent-harness-cli state active",
  "npx @brawnen/agent-harness-cli task intake \\"任务描述\\"",
  "npx @brawnen/agent-harness-cli task suspend-active --reason \\"切换任务\\""
];

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handlePromptSubmit, buildClaudeHookOutput } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildClaudeHookOutput("UserPromptSubmit", handlePromptSubmit({
    cwd,
    fallbackCommands: FALLBACK_COMMANDS,
    hostDisplayName: "Claude Code",
    prompt: resolvePayloadPrompt(payload)
  })));
} catch (error) {
  const { buildClaudeHookOutput } = await importRuntimeModule("runtime-host");
  writeHookOutput(buildClaudeHookOutput("UserPromptSubmit", {
    additionalContext: \`Claude Code UserPromptSubmit hook 执行失败：\${error.message}\`,
    status: "continue"
  }));
}
`;

const DEFAULT_CLAUDE_PRE_TOOL = `import { firstString, readHookPayload, resolvePayloadCwd, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handleBeforeTool, buildClaudeHookOutput } = await importRuntimeModule("runtime-host", cwd);
  const result = handleBeforeTool({
    command: firstString([
      payload?.tool_input?.command,
      payload?.toolInput?.command,
      payload?.input?.command,
      payload?.arguments?.command,
      payload?.tool_use?.input?.command,
      payload?.toolUse?.input?.command,
      payload?.command
    ]) ?? "",
    cwd,
    filePath: firstString([
      payload?.tool_input?.file_path,
      payload?.tool_input?.path,
      payload?.toolInput?.file_path,
      payload?.toolInput?.path,
      payload?.input?.file_path,
      payload?.input?.path,
      payload?.arguments?.file_path,
      payload?.arguments?.path,
      payload?.tool_use?.input?.file_path,
      payload?.tool_use?.input?.path,
      payload?.toolUse?.input?.file_path,
      payload?.toolUse?.input?.path
    ]),
    taskId: firstString([
      payload?.task_id,
      payload?.taskId,
      payload?.context?.task_id,
      payload?.context?.taskId
    ]),
    toolName: firstString([
      payload?.tool_name,
      payload?.toolName,
      payload?.tool?.name,
      payload?.toolUse?.name,
      payload?.name
    ])
  });
  writeHookOutput(buildClaudeHookOutput("PreToolUse", result));
} catch {
  writeHookOutput({});
}
`;

const DEFAULT_CLAUDE_POST_TOOL = `import { firstDefined, firstString, readHookPayload, resolvePayloadCwd, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { appendMinimalToolEvidence } = await importRuntimeModule("runtime-host", cwd);
  appendMinimalToolEvidence({
    cwd,
    exitCode: resolveExitCode(payload) ?? 0,
    toolName: firstString([
      payload?.tool_name,
      payload?.toolName,
      payload?.tool?.name,
      payload?.toolUse?.name,
      payload?.name
    ])
  });

  writeHookOutput({});
} catch {
  writeHookOutput({});
}

function resolveExitCode(payload) {
  const value = firstDefined([
    payload?.exit_code,
    payload?.exitCode,
    payload?.result?.exit_code,
    payload?.result?.exitCode,
    payload?.tool_output?.exit_code,
    payload?.toolOutput?.exitCode,
    payload?.status
  ]);

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
`;

const DEFAULT_CLAUDE_STOP = `import { readHookPayload, resolvePayloadCwd, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handleCompletionGate, buildClaudeHookOutput, resolveClaudeCompletionMessage } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildClaudeHookOutput("Stop", handleCompletionGate({
    cwd,
    lastAssistantMessage: resolveClaudeCompletionMessage(payload)
  })));
} catch {
  writeHookOutput({});
}
`;

const DEFAULT_GEMINI_SESSION_START = `import { readHookPayload, resolvePayloadCwd, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

const FALLBACK_COMMANDS = [
  "node packages/cli/bin/agent-harness.js state active",
  "node packages/cli/bin/agent-harness.js task intake \\"任务描述\\""
];

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handleSessionStart, buildGeminiHookOutput } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildGeminiHookOutput(handleSessionStart({
    cwd,
    fallbackCommands: FALLBACK_COMMANDS,
    hostDisplayName: "Gemini CLI",
    source: payload?.source ?? ""
  })));
} catch {
  writeHookOutput({});
}
`;

const DEFAULT_GEMINI_BEFORE_AGENT = `import { readHookPayload, resolvePayloadCwd, resolvePayloadPrompt, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

const FALLBACK_COMMANDS = [
  "node packages/cli/bin/agent-harness.js state active",
  "node packages/cli/bin/agent-harness.js task intake \\"任务描述\\"",
  "node packages/cli/bin/agent-harness.js task suspend-active --reason \\"切换任务\\""
];

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handlePromptSubmit, buildGeminiHookOutput } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildGeminiHookOutput(handlePromptSubmit({
    cwd,
    fallbackCommands: FALLBACK_COMMANDS,
    hostDisplayName: "Gemini CLI",
    prompt: resolvePayloadPrompt(payload)
  })));
} catch {
  writeHookOutput({});
}
`;

const DEFAULT_GEMINI_BEFORE_TOOL = `import { readHookPayload, resolvePayloadCwd, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const {
    handleBeforeTool,
    buildGeminiHookOutput,
    resolveGeminiToolCommand,
    resolveGeminiToolName,
    resolveGeminiToolPath
  } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildGeminiHookOutput(handleBeforeTool({
    command: resolveGeminiToolCommand(payload),
    cwd,
    filePath: resolveGeminiToolPath(payload),
    toolName: resolveGeminiToolName(payload)
  })));
} catch {
  writeHookOutput({});
}
`;

const DEFAULT_GEMINI_AFTER_TOOL = `import { readHookPayload, resolvePayloadCwd, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const {
    handleAfterTool,
    buildGeminiHookOutput,
    resolveGeminiToolCommand,
    resolveGeminiToolExitCode,
    resolveGeminiToolName,
    resolveGeminiToolOutput
  } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildGeminiHookOutput(handleAfterTool({
    command: resolveGeminiToolCommand(payload),
    cwd,
    exitCode: resolveGeminiToolExitCode(payload),
    output: resolveGeminiToolOutput(payload),
    toolName: resolveGeminiToolName(payload)
  })));
} catch {
  writeHookOutput({});
}
`;

const DEFAULT_GEMINI_AFTER_AGENT = `import { readHookPayload, resolvePayloadCwd, writeHookOutput } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handleCompletionGate, buildGeminiHookOutput, resolveGeminiCompletionMessage } = await importRuntimeModule("runtime-host", cwd);
  writeHookOutput(buildGeminiHookOutput(handleCompletionGate({
    cwd,
    lastAssistantMessage: resolveGeminiCompletionMessage(payload)
  })));
} catch {
  writeHookOutput({});
}
`;

const DEFAULT_CODEX_SESSION_START = `import { invokeAgentHarnessCodexHook, readHookPayload, writeContinue } from "./shared/codex-hook-io.js";

try {
  const payload = readHookPayload();
  process.stdout.write(\`\${JSON.stringify(await invokeAgentHarnessCodexHook("session-start", payload), null, 2)}\\n\`);
} catch (error) {
  await writeContinue("SessionStart", \`Codex SessionStart hook 执行失败：\${error.message}\`);
}
`;

const DEFAULT_CODEX_PRE_TOOL = `import { firstString, readHookPayload, resolvePayloadCwd } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handleBeforeTool, buildCodexHookOutput } = await importRuntimeModule("runtime-host", cwd);
  const result = handleBeforeTool({
    command: resolveCommand(payload),
    cwd,
    filePath: resolveFilePath(payload),
    taskId: resolveTaskId(payload),
    toolName: resolveToolName(payload)
  });
  process.stdout.write(\`\${JSON.stringify(buildCodexHookOutput("PreToolUse", result), null, 2)}\\n\`);
} catch {
  process.stdout.write("{}\\n");
}

function resolveToolName(payload) {
  return firstString([
    payload?.tool_name,
    payload?.toolName,
    payload?.tool?.name,
    payload?.toolUse?.name,
    payload?.name
  ]);
}

function resolveFilePath(payload) {
  return firstString([
    payload?.tool_input?.file_path,
    payload?.tool_input?.path,
    payload?.toolInput?.file_path,
    payload?.toolInput?.path,
    payload?.input?.file_path,
    payload?.input?.path,
    payload?.arguments?.file_path,
    payload?.arguments?.path,
    payload?.tool_use?.input?.file_path,
    payload?.tool_use?.input?.path,
    payload?.toolUse?.input?.file_path,
    payload?.toolUse?.input?.path
  ]);
}

function resolveTaskId(payload) {
  return firstString([
    payload?.task_id,
    payload?.taskId,
    payload?.context?.task_id,
    payload?.context?.taskId
  ]);
}

function resolveCommand(payload) {
  return firstString([
    payload?.tool_input?.command,
    payload?.toolInput?.command,
    payload?.input?.command,
    payload?.arguments?.command,
    payload?.tool_use?.input?.command,
    payload?.toolUse?.input?.command,
    payload?.command
  ]);
}

`;

const DEFAULT_CODEX_POST_TOOL = `import { firstDefined, firstString, readHookPayload, resolvePayloadCwd } from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handleAfterTool, buildCodexHookOutput } = await importRuntimeModule("runtime-host", cwd);
  const result = handleAfterTool({
    command: resolveCommand(payload),
    cwd,
    exitCode: resolveExitCode(payload),
    output: resolveOutput(payload),
    toolName: "Bash"
  });
  process.stdout.write(\`\${JSON.stringify(buildCodexHookOutput("PostToolUse", result), null, 2)}\\n\`);
} catch {
  process.stdout.write("{}\\n");
}

function resolveCommand(payload) {
  return firstString([
    payload?.tool_input?.command,
    payload?.toolInput?.command,
    payload?.input?.command,
    payload?.arguments?.command,
    payload?.tool_use?.input?.command,
    payload?.toolUse?.input?.command,
    payload?.command
  ]) ?? "<unknown command>";
}

function resolveExitCode(payload) {
  const value = firstDefined([
    payload?.exit_code,
    payload?.exitCode,
    payload?.result?.exit_code,
    payload?.result?.exitCode,
    payload?.tool_output?.exit_code,
    payload?.toolOutput?.exitCode,
    payload?.status
  ]);

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function resolveOutput(payload) {
  return firstString([
    payload?.tool_response,
    payload?.output,
    payload?.stdout,
    payload?.stderr,
    payload?.result?.output,
    payload?.result?.stdout,
    payload?.result?.stderr,
    payload?.tool_output?.output,
    payload?.toolOutput?.output
  ]) ?? "";
}

`;

const DEFAULT_CODEX_SHARED_IO = `import fs from "node:fs";
import { importRuntimeModule } from "../../../shared/runtime-loader.js";

export function readHookPayload() {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("hook stdin 不是合法 JSON");
  }
}

export function resolvePayloadCwd(payload) {
  if (typeof payload?.cwd === "string" && payload.cwd.trim()) {
    return payload.cwd.trim();
  }

  return process.cwd();
}

export function resolvePayloadPrompt(payload) {
  if (typeof payload?.prompt === "string" && payload.prompt.trim()) {
    return payload.prompt.trim();
  }

  if (typeof payload?.user_prompt === "string" && payload.user_prompt.trim()) {
    return payload.user_prompt.trim();
  }

  return "";
}

export function buildManualFallbackContext(reason, { commands = [], hostDisplayName = "Codex" } = {}) {
  const safeReason = typeof reason === "string" && reason.trim()
    ? reason.trim()
    : \`\${hostDisplayName} hook 执行失败\`;
  const fallbackCommands = Array.isArray(commands)
    ? commands.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];

  if (fallbackCommands.length === 0) {
    return \`\${safeReason}，已降级继续。\`;
  }

  return \`\${safeReason}，已降级。手动命令：\${fallbackCommands.join("；")}\`;
}

export async function writeContinue(hookEventName, additionalContext = "") {
  const { buildCodexHookOutput } = await importRuntimeModule("runtime-host");
  const text = typeof additionalContext === "string" ? additionalContext.trim() : "";
  process.stdout.write(\`\${JSON.stringify(
    buildCodexHookOutput(hookEventName, {
      additionalContext: text,
      status: "continue"
    }),
    null,
    2
  )}\\n\`);
}

export async function writeBlock(reason) {
  const { buildCodexHookOutput } = await importRuntimeModule("runtime-host");
  process.stdout.write(\`\${JSON.stringify(
    buildCodexHookOutput("Block", { reason, status: "block" }),
    null,
    2
  )}\\n\`);
}

export async function invokeAgentHarnessCodexHook(event, payload) {
  const cwd = resolvePayloadCwd(payload);
  try {
    const { handlePromptSubmit, handleSessionStart, buildCodexHookOutput } = await importRuntimeModule("runtime-host", cwd);

    if (event === "session-start") {
      return buildCodexHookOutput("SessionStart", handleSessionStart({
        cwd,
        fallbackCommands: SESSION_START_FALLBACK_COMMANDS,
        hostDisplayName: "Codex",
        source: payload?.source ?? ""
      }));
    }

    if (event === "user-prompt-submit") {
      return buildCodexHookOutput("UserPromptSubmit", handlePromptSubmit({
        cwd,
        fallbackCommands: MANUAL_FALLBACK_COMMANDS,
        hostDisplayName: "Codex",
        prompt: resolvePayloadPrompt(payload)
      }));
    }

    throw new Error(\`未知 Codex hook 事件: \${event}\`);
  } catch (error) {
    const hookEventName = event === "session-start" ? "SessionStart" : "UserPromptSubmit";
    const fallbackCommands = event === "session-start" ? SESSION_START_FALLBACK_COMMANDS : MANUAL_FALLBACK_COMMANDS;
    const { buildCodexHookOutput } = await importRuntimeModule("runtime-host", cwd);
    return buildCodexHookOutput(hookEventName, {
      additionalContext: buildManualFallbackContext(
        \`Codex \${hookEventName} hook 执行失败：\${error.message}\`,
        { commands: fallbackCommands, hostDisplayName: "Codex" }
      ),
      status: "continue"
    });
  }
}
`;

const DEFAULT_SOURCE_FILES = {
  [path.posix.join(SOURCE_ROOT, "package.json")]: `{
  "type": "module"
}
`,
  [path.posix.join(HOSTS_ROOT, "shared", "payload-io.js")]: DEFAULT_SHARED_PAYLOAD_IO,
  [path.posix.join(HOSTS_ROOT, "shared", "runtime-loader.js")]: DEFAULT_SHARED_RUNTIME_LOADER,
  [path.posix.join(HOSTS_ROOT, "codex", "config.toml")]: DEFAULT_CODEX_CONFIG,
  [path.posix.join(HOSTS_ROOT, "codex", "hooks.json")]: DEFAULT_CODEX_HOOKS_JSON,
  [path.posix.join(HOSTS_ROOT, "codex", "hooks", "user_prompt_submit_intake.js")]: DEFAULT_CODEX_USER_PROMPT,
  [path.posix.join(HOSTS_ROOT, "codex", "hooks", "session_start_restore.js")]: DEFAULT_CODEX_SESSION_START,
  [path.posix.join(HOSTS_ROOT, "codex", "hooks", "pre_tool_use_gate.js")]: DEFAULT_CODEX_PRE_TOOL,
  [path.posix.join(HOSTS_ROOT, "codex", "hooks", "post_tool_use_record_evidence.js")]: DEFAULT_CODEX_POST_TOOL,
  [path.posix.join(HOSTS_ROOT, "codex", "hooks", "shared", "codex-hook-io.js")]: DEFAULT_CODEX_SHARED_IO,
  [path.posix.join(HOSTS_ROOT, "claude", "settings.json")]: DEFAULT_CLAUDE_SETTINGS,
  [path.posix.join(HOSTS_ROOT, "claude", "hooks", "session_start.js")]: DEFAULT_CLAUDE_SESSION_START,
  [path.posix.join(HOSTS_ROOT, "claude", "hooks", "user_prompt_submit.js")]: DEFAULT_CLAUDE_USER_PROMPT,
  [path.posix.join(HOSTS_ROOT, "claude", "hooks", "pre_tool_use.js")]: DEFAULT_CLAUDE_PRE_TOOL,
  [path.posix.join(HOSTS_ROOT, "claude", "hooks", "post_tool_use.js")]: DEFAULT_CLAUDE_POST_TOOL,
  [path.posix.join(HOSTS_ROOT, "claude", "hooks", "stop.js")]: DEFAULT_CLAUDE_STOP,
  [path.posix.join(HOSTS_ROOT, "gemini", "settings.json")]: DEFAULT_GEMINI_SETTINGS,
  [path.posix.join(HOSTS_ROOT, "gemini", "hooks", "session_start.js")]: DEFAULT_GEMINI_SESSION_START,
  [path.posix.join(HOSTS_ROOT, "gemini", "hooks", "before_agent.js")]: DEFAULT_GEMINI_BEFORE_AGENT,
  [path.posix.join(HOSTS_ROOT, "gemini", "hooks", "before_tool.js")]: DEFAULT_GEMINI_BEFORE_TOOL,
  [path.posix.join(HOSTS_ROOT, "gemini", "hooks", "after_tool.js")]: DEFAULT_GEMINI_AFTER_TOOL,
  [path.posix.join(HOSTS_ROOT, "gemini", "hooks", "after_agent.js")]: DEFAULT_GEMINI_AFTER_AGENT,
  [path.posix.join(RULES_ROOT, "shared.md")]: DEFAULT_SHARED_RULES,
  [path.posix.join(RULES_ROOT, "codex.md")]: DEFAULT_RULE_DELTAS.codex,
  [path.posix.join(RULES_ROOT, "claude.md")]: DEFAULT_RULE_DELTAS["claude-code"],
  [path.posix.join(RULES_ROOT, "gemini.md")]: DEFAULT_RULE_DELTAS["gemini-cli"]
};

export function collectHostLayoutWrites(cwd, options = {}) {
  const hosts = normalizeHosts(options.hosts);
  const rewrite = options.rewrite === true;
  const check = options.check === true;
  const seedMissing = options.seedMissing !== false;
  const includeConfigs = options.includeConfigs !== false;
  const includeRules = options.includeRules !== false;

  const writes = [];
  const warnings = [];
  const desired = new Map();

  for (const relativePath of requiredSourcePaths(hosts, { includeConfigs, includeRules })) {
    const targetPath = path.join(cwd, relativePath);
    const content = `${String(DEFAULT_SOURCE_FILES[relativePath] ?? "").replace(/\s*$/, "")}\n`;
    desired.set(relativePath, content);

    if (!fs.existsSync(targetPath)) {
      if (check || !seedMissing) {
        warnings.push(`缺少布局源文件: ${relativePath}`);
        continue;
      }

      writes.push({
        content,
        relativePath,
        targetPath,
        type: "source"
      });
      continue;
    }
  }

  for (const host of hosts) {
    if (includeConfigs) {
      for (const mapping of COPY_TARGETS[host] ?? []) {
        const sourceContent = readDesiredContent(cwd, mapping.source, desired);
        if (sourceContent == null) {
          warnings.push(`缺少宿主源文件: ${mapping.source}`);
          continue;
        }

        queueWriteIfChanged(writes, cwd, mapping.target, sourceContent, "host");
      }
    }

    if (includeRules) {
      const renderedRules = renderRuleDocument(cwd, host, desired);
      if (!renderedRules) {
        warnings.push(`缺少规则源文件，无法生成 ${RULE_TARGETS[host]}`);
        continue;
      }

      const ruleTarget = RULE_TARGETS[host];
      const rulePath = path.join(cwd, ruleTarget);
      const existing = fs.existsSync(rulePath) ? fs.readFileSync(rulePath, "utf8") : "";
      const nextContent = buildRuleTargetContent(existing, renderedRules, rewrite);

      if (nextContent == null) {
        warnings.push(`${ruleTarget} 已存在且未受管，使用 sync --rewrite 才会覆盖`);
        continue;
      }

      queueWriteIfChanged(writes, cwd, ruleTarget, nextContent, "rule");
    }
  }

  if (includeConfigs || includeRules) {
    const manifestContent = buildManifestContent(cwd, hosts, desired, { includeConfigs, includeRules });
    queueWriteIfChanged(writes, cwd, MANIFEST_TARGET, manifestContent, "generated");
  }

  return { warnings, writes };
}

export function applyHostLayoutWrites(writes) {
  for (const write of writes) {
    fs.mkdirSync(path.dirname(write.targetPath), { recursive: true });
    fs.writeFileSync(write.targetPath, write.content, "utf8");
  }
}

export function hasConvergedHostLayout(cwd) {
  return fs.existsSync(path.join(cwd, HOSTS_ROOT)) && fs.existsSync(path.join(cwd, RULES_ROOT));
}

function normalizeHosts(hosts) {
  const values = Array.isArray(hosts) && hosts.length > 0 ? hosts : HOST_LAYOUT_HOSTS;
  return values.filter((host) => HOST_LAYOUT_HOSTS.includes(host));
}

function requiredSourcePaths(hosts, options = {}) {
  const includeConfigs = options.includeConfigs !== false;
  const includeRules = options.includeRules !== false;
  const paths = new Set([
    path.posix.join(SOURCE_ROOT, "package.json"),
    path.posix.join(HOSTS_ROOT, "shared", "payload-io.js"),
    path.posix.join(HOSTS_ROOT, "shared", "runtime-loader.js")
  ]);

  if (includeRules) {
    paths.add(path.posix.join(RULES_ROOT, "shared.md"));
  }

  for (const host of hosts) {
    if (includeConfigs) {
      for (const mapping of COPY_TARGETS[host] ?? []) {
        paths.add(mapping.source);
      }
    }

    if (host === "codex" && includeConfigs) {
      paths.add(path.posix.join(HOSTS_ROOT, "codex", "hooks", "user_prompt_submit_intake.js"));
      paths.add(path.posix.join(HOSTS_ROOT, "codex", "hooks", "session_start_restore.js"));
      paths.add(path.posix.join(HOSTS_ROOT, "codex", "hooks", "pre_tool_use_gate.js"));
      paths.add(path.posix.join(HOSTS_ROOT, "codex", "hooks", "post_tool_use_record_evidence.js"));
      paths.add(path.posix.join(HOSTS_ROOT, "codex", "hooks", "shared", "codex-hook-io.js"));
    }

    if (host === "claude-code" && includeConfigs) {
      paths.add(path.posix.join(HOSTS_ROOT, "claude", "hooks", "session_start.js"));
      paths.add(path.posix.join(HOSTS_ROOT, "claude", "hooks", "user_prompt_submit.js"));
      paths.add(path.posix.join(HOSTS_ROOT, "claude", "hooks", "pre_tool_use.js"));
      paths.add(path.posix.join(HOSTS_ROOT, "claude", "hooks", "post_tool_use.js"));
      paths.add(path.posix.join(HOSTS_ROOT, "claude", "hooks", "stop.js"));
    }

    if (host === "gemini-cli" && includeConfigs) {
      paths.add(path.posix.join(HOSTS_ROOT, "gemini", "hooks", "session_start.js"));
      paths.add(path.posix.join(HOSTS_ROOT, "gemini", "hooks", "before_agent.js"));
      paths.add(path.posix.join(HOSTS_ROOT, "gemini", "hooks", "before_tool.js"));
      paths.add(path.posix.join(HOSTS_ROOT, "gemini", "hooks", "after_tool.js"));
      paths.add(path.posix.join(HOSTS_ROOT, "gemini", "hooks", "after_agent.js"));
    }

    if (includeRules) {
      if (host === "codex") {
        paths.add(path.posix.join(RULES_ROOT, "codex.md"));
        continue;
      }

      if (host === "claude-code") {
        paths.add(path.posix.join(RULES_ROOT, "claude.md"));
        continue;
      }

      if (host === "gemini-cli") {
        paths.add(path.posix.join(RULES_ROOT, "gemini.md"));
      }
    }
  }

  return [...paths];
}

function readDesiredContent(cwd, relativePath, desired) {
  if (desired.has(relativePath)) {
    return desired.get(relativePath);
  }

  const fullPath = path.join(cwd, relativePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  return ensureTrailingNewline(fs.readFileSync(fullPath, "utf8"));
}

function renderRuleDocument(cwd, host, desired) {
  const shared = readDesiredContent(cwd, path.posix.join(RULES_ROOT, "shared.md"), desired);
  const deltaName = host === "codex" ? "codex.md" : host === "claude-code" ? "claude.md" : "gemini.md";
  const delta = readDesiredContent(cwd, path.posix.join(RULES_ROOT, deltaName), desired);
  if (!shared || !delta) {
    return null;
  }

  const body = [shared.trim(), delta.trim()].filter(Boolean).join("\n\n");
  return ensureTrailingNewline([
    `<!-- agent-harness:start version="${HOST_LAYOUT_VERSION}" rules="${HOST_LAYOUT_RULES_MODE}" -->`,
    body,
    "<!-- agent-harness:end -->"
  ].join("\n"));
}

function buildRuleTargetContent(existing, renderedRules, rewrite) {
  if (!existing.trim()) {
    return renderedRules;
  }

  if (containsManagedBlock(existing)) {
    return existing.replace(/<!-- agent-harness:start[\s\S]*?<!-- agent-harness:end -->\n?/m, renderedRules);
  }

  if (rewrite) {
    return renderedRules;
  }

  const prefix = existing.replace(/\s*$/, "");
  return ensureTrailingNewline(`${prefix}\n\n${renderedRules.trim()}`);
}

function containsManagedBlock(content) {
  return content.includes("<!-- agent-harness:start") && content.includes("<!-- agent-harness:end -->");
}

function queueWriteIfChanged(writes, cwd, relativePath, content, type) {
  const targetPath = path.join(cwd, relativePath);
  const normalized = ensureTrailingNewline(content);
  const existing = fs.existsSync(targetPath) ? ensureTrailingNewline(fs.readFileSync(targetPath, "utf8")) : null;
  if (existing === normalized) {
    return;
  }

  writes.push({
    content: normalized,
    relativePath,
    targetPath,
    type
  });
}

function buildManifestContent(cwd, hosts, desired, options = {}) {
  const includeConfigs = options.includeConfigs !== false;
  const includeRules = options.includeRules !== false;
  const files = [];

  for (const relativePath of requiredSourcePaths(hosts, { includeConfigs, includeRules })) {
    files.push({
      path: relativePath,
      kind: classifyManifestFileKind(relativePath)
    });
  }

  for (const host of hosts) {
    if (includeConfigs) {
      for (const mapping of COPY_TARGETS[host] ?? []) {
        files.push({
          path: mapping.target,
          kind: "generated_host"
        });
      }
    }
    if (includeRules) {
      files.push({
        path: RULE_TARGETS[host],
        kind: "generated_rule"
      });
    }
  }

  const manifest = {
    layout: "converged-host-layout-v1",
    version: HOST_LAYOUT_VERSION,
    hosts,
    files
  };

  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function ensureTrailingNewline(content) {
  return `${String(content ?? "").replace(/\s*$/, "")}\n`;
}

function classifyManifestFileKind(relativePath) {
  if (relativePath.startsWith(HOSTS_ROOT)) {
    return "host_source";
  }

  if (relativePath.startsWith(RULES_ROOT)) {
    return "rule_source";
  }

  return "layout_source";
}
