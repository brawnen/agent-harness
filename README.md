# agent-harness

[English](README.en.md)

让 AI coding agent 在真实仓库里更可控，而不只是“更会写代码”。

`agent-harness` 面向 `Codex`、`Claude Code`、`Gemini CLI` 等宿主，提供一层统一的任务控制与交付约束：

- 让 agent 先 intake、再澄清、再执行，而不是一上来就改文件
- 让任务有状态、有门禁、有验证、有交付收口
- 让越界写入、高风险操作、未验证完成这类问题尽量前置暴露
- 让不同宿主下的工作节奏尽量一致，而不是每换一个 agent 就换一套纪律

如果一句话概括它的价值：

> 它不是帮 agent 写更多代码，而是减少 agent 在真实项目里写错、跑偏、忘验证、乱收口。

## 它解决什么问题

大部分 AI coding agent 在 demo 里都很强，但进入真实仓库后，常见问题会立刻出现：

- 不知道当前是不是同一个任务
- 需求和范围还没闭合就开始动文件
- 写到了 scope 之外或者高风险目录
- 做完没有证据、没有验证、没有收口
- 口头说“完成”，但没有 report、没有交付边界、没有提交策略

`agent-harness` 给这些问题补的是一层最小但明确的控制面：

- `intake / clarify / observe / verify / report`
- `state / audit / gate / delivery`
- `protected_paths / risk_rules / output_policy / delivery_policy`

## 适合谁

这个项目最适合：

- 已经在真实仓库里使用 AI coding agent 的个人开发者或小团队
- 需要在 `Codex / Claude Code / Gemini CLI` 之间复用一套任务纪律的人
- 维护中大型仓库、低测试覆盖仓库、历史包袱仓库的人
- 更关心“可控、可验证、可交付”而不是单纯“更快”的人

## 不适合谁

如果你的场景是下面这些，这个项目的价值会弱很多：

- 一次性 PoC、玩具项目、临时脚本
- 只把 agent 当问答助手，不让它真正执行写操作
- 不想接受任何流程约束、验证门禁或状态记录
- 只追求速度，不在乎 scope、验证、交付质量

## 你会得到什么

从用户视角，`agent-harness` 交付的不是“新模型能力”，而是 4 个结果：

- 更不容易改错地方
- 更不容易丢掉当前任务上下文
- 更不容易没验证就宣称完成
- 更容易在不同宿主之间复用同一套执行规则

## 两种接入方式

### 1. 只接入协议规则

适合：

- 先低成本试用
- 只想引入行为规则，不想先上 CLI
- 先验证团队是否接受这套工作方式

做法：

1. 把 [packages/protocol/rules/base.md](packages/protocol/rules/base.md) 或 [packages/protocol/rules/full.md](packages/protocol/rules/full.md) 复制到项目的 `AGENTS.md`、`CLAUDE.md` 或 `GEMINI.md`
2. 按需引用：
   - [packages/protocol/templates](packages/protocol/templates)
   - [packages/protocol/schemas](packages/protocol/schemas)
   - [packages/protocol/adapters](packages/protocol/adapters)

你会获得：

- intake / clarify / observe / verify / report 的规则约束
- 任务模板与 schema
- 各宿主的接入示例

### 2. 协议规则 + CLI + hooks

适合：

- 希望任务有状态持久化
- 希望执行前有门禁，完成前有验证
- 希望把 agent 工作流真正接进工程交付流程

当前 npm 入口：

```bash
npx @brawnen/agent-harness-cli init
npx @brawnen/agent-harness-cli init --protocol-only
```

本地源码入口：

```bash
node packages/cli/bin/agent-harness.js init --dry-run
node packages/cli/bin/agent-harness.js init --host codex
node packages/cli/bin/agent-harness.js status
```

说明：

- 当前 npm 包已发布
- 推荐优先使用 npm 入口：`npx @brawnen/agent-harness-cli init`
- 本地运行要求 `Node.js >= 18`
- 如果你只想复用规则与模板，也可以直接安装 `@brawnen/agent-harness-protocol`

## 快速开始

### Protocol only

1. 复制规则文件到目标仓库的 `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`
2. 根据需要复制模板和 schema
3. 在宿主里开始按规则使用

### npm CLI

如果你要在一个现有项目里正式使用 `agent-harness`，现在推荐直接走 npm：

```bash
npx @brawnen/agent-harness-cli init --host codex
npx @brawnen/agent-harness-cli status
```

或先安装到项目里：

```bash
npm install -D @brawnen/agent-harness-cli
npx agent-harness init --host codex
```

### Local CLI

如果你想直接复用本机源码仓库里的开发版 CLI，也可以继续用本地路径：

```bash
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js init --host codex
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js status
```

更完整的跨项目接入说明见：

- [How To Use Agent Harness In This Repository And Other Projects](docs/2026-04-05-agent-harness-usage-guide-v0.1.md)

## 在本仓库里怎么用

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

- [How To Use Agent Harness In This Repository And Other Projects](docs/2026-04-05-agent-harness-usage-guide-v0.1.md)

### Codex

当前仓库已经内置：

- [.codex/config.toml](.codex/config.toml)
- [.codex/hooks.json](.codex/hooks.json)
- [.codex/hooks/user_prompt_submit_intake.js](.codex/hooks/user_prompt_submit_intake.js)
- [.codex/hooks/session_start_restore.js](.codex/hooks/session_start_restore.js)
- [.codex/hooks/pre_tool_use_gate.js](.codex/hooks/pre_tool_use_gate.js)
- [.codex/hooks/post_tool_use_record_evidence.js](.codex/hooks/post_tool_use_record_evidence.js)

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

当前暂时关闭：

- `PreToolUse`：前置 `gate before-tool`
- `PostToolUse`：自动 evidence 记录

原因：

- 当前 `Codex` 还不支持禁用 `statusMessage`，工具级 hook 会带来较明显的视觉噪音
- 等 `Codex` 支持后，再重新放开这两个自动调用

相关设计规范见：

- [Codex Hook 可见性规范 v0.1](docs/2026-04-06-codex-hook-visibility-policy-v0.1.md)

### Claude Code

当前仓库已具备 `Claude Code` 宿主接入的最小闭环：

- `init --host claude-code` 会注入 `CLAUDE.md` 规则块
- `init --host claude-code` 会创建或合并 `.claude/settings.json`
- `.claude/settings.json` 当前接入：
  - `SessionStart`：恢复 active task 摘要
  - `UserPromptSubmit`：自动 intake / continue / clarify / override
  - `PreToolUse`：前置 `gate before-tool`
  - `PostToolUse`：工具后 `state update`
  - `Stop`：完成宣告前的最小完成门禁

当前边界：

- `Claude Code` 现在已经具备 session / prompt / tool / stop 四层 hook 接入
- 但 `Stop` 仍是“完成宣告门禁”，不是对所有自然语言回复做全面语义审查
- 相比当前仓库内置的 `Codex` 链路，`Claude Code` 仍缺少同等级的 repo-local运行时文档与回归脚本沉淀

### Gemini CLI

当前仓库已具备 `Gemini CLI` 宿主接入的最小闭环：

- `init --host gemini-cli` 会注入 `GEMINI.md` 规则块
- `init --host gemini-cli` 会创建或合并 `.gemini/settings.json`
- 默认会创建 `.harness/` 运行时目录与任务模板
- `status` 会明确识别 `Gemini CLI` 的 hook 接入状态
- `.gemini/settings.json` 当前接入：
  - `SessionStart`：恢复 active task 摘要
  - `BeforeAgent`：自动 intake / continue / clarify / override
  - `BeforeTool`：前置 `gate before-tool`
  - `AfterTool`：自动记录 shell evidence
  - `AfterAgent`：完成宣告前的最小完成门禁

当前边界：

- `Gemini CLI` 当前接入的是最小 hook 闭环，不是完整宿主抽象能力对齐
- `AfterTool` 当前只对 shell 工具记录高价值 evidence，不把所有工具结果都写入 state
- 即便有 hooks，`GEMINI.md` 规则与 CLI 状态机仍是协议约束的最后兜底

## Current Status

当前最完整的参考链路仍是 `Codex`。其中 `Codex` 当前默认启用 `SessionStart / UserPromptSubmit`，`PreToolUse / PostToolUse` 因视觉噪音问题暂时关闭；`Claude Code` 已支持 `CLAUDE.md + SessionStart / UserPromptSubmit / PreToolUse / PostToolUse / Stop` 的 hook 集成闭环，`Gemini CLI` 已支持 `.gemini/settings.json + GEMINI.md + CLI` 的最小 hook 闭环。

已经形成完整最小闭环的能力包括：

- `task intake / confirm / suspend-active`
- `state`
- `verify`
- `report`
- `gate`
- `audit`
- `delivery ready / request / commit`
- `docs scaffold`
- `Codex` 的 `SessionStart / UserPromptSubmit`
- `Gemini CLI` 的 `SessionStart / BeforeAgent / BeforeTool / AfterTool / AfterAgent`

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

- [packages/cli/README.zh-CN.md](packages/cli/README.zh-CN.md)
- [packages/protocol/README.zh-CN.md](packages/protocol/README.zh-CN.md)

## How To Use It In A Project

最推荐的接入路径是：

1. 在目标项目执行 `npx @brawnen/agent-harness-cli init --host codex`
2. 让 CLI 生成：
   - `harness.yaml`
   - `.harness/`
   - 宿主规则 block
   - 宿主支持时的 hooks 配置
3. 日常使用：
   - `agent-harness status`
   - `agent-harness task intake`
   - `agent-harness verify`
   - `agent-harness report`
   - `agent-harness delivery commit`

如果你只想要协议规则，不想引入运行时目录：

1. 安装或复制 `@brawnen/agent-harness-protocol`
2. 把 `rules/base.md` 或 `rules/full.md` 写入 `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`
3. 按需复用 `templates/` 与 `schemas/`

## What Is Still Missing Before Broader Open Source Adoption

当前项目已经具备个人与团队试用条件，欢迎更多开发者在真实项目中尝试接入并反馈。

主要还差：

- README / Quick Start 的进一步收口
- 更多宿主支持
  - `Antigravity`
- `Claude Code` 与 `Codex` 之间更高等级的能力对齐
- `Gemini CLI` 与 `Claude Code` / `Codex` 之间更高等级的能力对齐
- 更完整的 CI / release 流程
- 更丰富的宿主 E2E 与误判样本回归

## Documentation

- [Agent Harness Design v0.3](docs/2026-04-03-agent-harness-design-v0.3.md)
- [Open Source Architecture ADR](docs/2026-04-02-agent-harness-open-source-architecture-adr-v0.1.md)
- [Codex Auto Intake Design](docs/2026-04-03-codex-auto-intake-design-v0.1.md)
- [Codex Hooks Workflow](docs/2026-04-03-codex-hooks-workflow-v0.1.md)
- [Codex v0.3 Roadmap](docs/2026-04-04-codex-v0.3-roadmap.md)
- [CHANGELOG Maintenance Policy](docs/2026-04-04-changelog-maintenance-policy-v0.1.md)
- [Workflow Policy Design v0.1](docs/2026-04-05-workflow-policy-design-v0.1.md)
- [Task Core Misclassification Fixture Workflow](docs/2026-04-03-task-core-misclassification-fixture-workflow-v0.1.md)
- [How To Use Agent Harness In This Repository And Other Projects](docs/2026-04-05-agent-harness-usage-guide-v0.1.md)
- [CLI README（中文）](packages/cli/README.zh-CN.md)
- [Protocol README（中文）](packages/protocol/README.zh-CN.md)
- [CLI README（English）](packages/cli/README.md)
- [Protocol README（English）](packages/protocol/README.md)

Historical drafts and early specs are archived under [`docs/archive/`](docs/archive).
