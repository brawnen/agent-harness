# agent-harness

[English](README.en.md)

`agent-harness` 是一套面向 `Codex`、`Claude Code`、`Gemini CLI` 等宿主的任务收敛协议与工具集。

它解决的不是“让 agent 更会写代码”，而是：

- 让 agent 在真实项目里按边界工作
- 让任务有状态、有验证、有交付收口
- 让高风险写入和越界操作尽量在执行前被拦住

当前项目已经形成一条完整的 `Codex` 主链路：

- `protocol` 负责规则、schema、模板、宿主适配说明
- `cli` 负责 `init / status / task / state / verify / report / gate / audit / delivery / docs`
- `Codex hooks` 负责自动 intake、前置门禁、自动 evidence 和上下文恢复

## Why Agent Harness

大部分 AI coding agent 在 demo 里看起来很强，但进入真实项目后常见问题是：

- 不知道当前是不是同一个任务
- 需求还没闭合就开始修改文件
- 越过 scope 或写到高风险目录
- 做完后没有验证证据
- 说“完成”时没有 report、没有交付边界、没有提交收口

`agent-harness` 的目标是给这些行为加上最小但明确的工程约束：

- `intake / clarify / observe / verify / report`
- `state / audit / gate / delivery`
- `protected_paths / risk_rules / output_policy / delivery_policy`

## Two Ways To Use It

### 1. Protocol only

适合：

- 只想要行为规则
- 不想装 CLI
- 先在现有项目里低成本试用

做法：

1. 把 [packages/protocol/rules/base.md](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/rules/base.md) 或 [packages/protocol/rules/full.md](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/rules/full.md) 复制到项目的 `AGENTS.md`、`CLAUDE.md` 或 `GEMINI.md`
2. 按需引用：
   - [packages/protocol/templates](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/templates)
   - [packages/protocol/schemas](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/schemas)
   - [packages/protocol/adapters](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/adapters)

你会获得：

- intake / clarify / observe / verify / report 的规则约束
- 任务模板与 schema
- 各宿主的规则注入示例

### 2. Protocol + CLI

适合：

- 希望有状态持久化
- 希望有前置门禁、审计和报告
- 希望把任务闭环真正接进工程交付流程

当前本仓库的可用入口：

```bash
node packages/cli/bin/agent-harness.js init --dry-run
node packages/cli/bin/agent-harness.js init --host codex
node packages/cli/bin/agent-harness.js status
```

未来发布后的目标入口：

```bash
npx @agent-harness/cli init
npx @agent-harness/cli init --protocol-only
```

说明：

- 当前仓库尚未发布到 npm
- README 中出现的 `npx @agent-harness/cli ...` 是目标分发形态，不是已发布事实
- 本地运行要求 `Node.js >= 18`

## Use Agent Harness In This Repository

当前仓库已经把 `agent-harness` 用在自己身上。

你现在就可以直接在本仓库里这样使用：

```bash
codex
node packages/cli/bin/agent-harness.js status
node packages/cli/bin/agent-harness.js delivery ready
```

当前仓库的自举形态包括：

- `harness.yaml` 作为项目策略入口
- `.harness/state`、`.harness/audit`、`.harness/reports` 作为运行时目录
- `.codex/config.toml` 与 `.codex/hooks.json` 作为 Codex 宿主接入层
- `delivery commit` 作为本地提交标准入口

如果你想看更完整的自举与跨项目接入方式，见：

- [How To Use Agent Harness In This Repository And Other Projects](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-05-agent-harness-usage-guide-v0.1.md)

## Quick Start

### Protocol only

1. 复制规则文件到目标仓库的 `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`
2. 根据需要复制模板和 schema
3. 在宿主里开始按规则使用

### Local CLI

如果你现在就想在其他项目里试用当前仓库里的 CLI，可以直接用本地路径：

```bash
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js init --host codex
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js status
```

更完整的跨项目接入说明见：

- [How To Use Agent Harness In This Repository And Other Projects](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-05-agent-harness-usage-guide-v0.1.md)

### Codex

当前仓库已经内置：

- [.codex/config.toml](/Users/lijianfeng/code/pp/agent-harness/.codex/config.toml)
- [.codex/hooks.json](/Users/lijianfeng/code/pp/agent-harness/.codex/hooks.json)
- [.codex/hooks/user_prompt_submit_intake.js](/Users/lijianfeng/code/pp/agent-harness/.codex/hooks/user_prompt_submit_intake.js)
- [.codex/hooks/session_start_restore.js](/Users/lijianfeng/code/pp/agent-harness/.codex/hooks/session_start_restore.js)
- [.codex/hooks/pre_tool_use_gate.js](/Users/lijianfeng/code/pp/agent-harness/.codex/hooks/pre_tool_use_gate.js)
- [.codex/hooks/post_tool_use_record_evidence.js](/Users/lijianfeng/code/pp/agent-harness/.codex/hooks/post_tool_use_record_evidence.js)

在当前仓库内直接运行：

```bash
codex
```

或：

```bash
codex exec "继续推进当前任务"
```

当前 `Codex` 已接入：

- `SessionStart`：恢复 active task 摘要
- `UserPromptSubmit`：自动 intake / continue / clarify / override
- `PreToolUse`：前置 `gate before-tool`
- `PostToolUse`：自动 evidence 记录

## Current Status

当前最完整的宿主是 `Codex`。

已经形成完整最小闭环的能力包括：

- `task intake / confirm / suspend-active`
- `state`
- `verify`
- `report`
- `gate`
- `audit`
- `delivery ready / request / commit`
- `docs scaffold`
- `Codex` 的 `SessionStart / UserPromptSubmit / PreToolUse / PostToolUse`

当前边界：

- `commit`：支持显式请求触发，并推荐由 skill 承载
- `push`：保留为人工动作，不自动化
- `Bash` 的前置路径识别只覆盖高置信常见写命令
- 复杂 shell 语法仍会保守降级

## Repository Layout

```text
.
├── docs/           # 设计文档、ADR、roadmap、策略说明
├── .harness/       # 运行时 state / audit / reports / tasks
├── packages/
│   ├── protocol/   # rules / schemas / templates / adapters
│   └── cli/        # Node.js CLI
└── package.json    # workspace 根配置
```

## Current Commands

`packages/cli` 当前已具备这些核心命令：

- `init`
- `status`
- `task`
- `state`
- `verify`
- `report`
- `gate`
- `audit`
- `delivery`
- `docs`

更细的命令边界见：

- [packages/cli/README.md](/Users/lijianfeng/code/pp/agent-harness/packages/cli/README.md)
- [packages/protocol/README.md](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/README.md)

## What Is Still Missing Before Broader Open Source Adoption

当前项目已经达到“个人/团队内部可用”的阶段，但还没到“全球开发者低摩擦采用”的阶段。

主要还差：

- npm 发布与版本化分发
- README / Quick Start 的进一步收口
- 更多宿主支持
  - `Claude Code`
  - `Gemini CLI`
  - `Antigravity`
- 更完整的 CI / release 流程
- 更丰富的宿主 E2E 与误判样本回归

## Documentation

- [Agent Harness Design v0.3](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-03-agent-harness-design-v0.3.md)
- [Open Source Architecture ADR](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-02-agent-harness-open-source-architecture-adr-v0.1.md)
- [Codex Auto Intake Design](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-03-codex-auto-intake-design-v0.1.md)
- [Codex Hooks Workflow](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-03-codex-hooks-workflow-v0.1.md)
- [Codex v0.3 Roadmap](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-04-codex-v0.3-roadmap.md)
- [CHANGELOG Maintenance Policy](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-04-changelog-maintenance-policy-v0.1.md)
- [Task Core Misclassification Fixture Workflow](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-03-task-core-misclassification-fixture-workflow-v0.1.md)
- [How To Use Agent Harness In This Repository And Other Projects](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-05-agent-harness-usage-guide-v0.1.md)
- [CLI README](/Users/lijianfeng/code/pp/agent-harness/packages/cli/README.md)
- [Protocol README](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/README.md)

Historical drafts and early specs are archived under [`docs/archive/`](/Users/lijianfeng/code/pp/agent-harness/docs/archive).
