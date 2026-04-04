# agent-harness

`agent-harness` 是一套面向 Claude Code、Codex、Gemini CLI 等宿主的任务收敛协议与工具集。

它关注的不是“让 agent 会写代码”，而是“让 agent 在真实项目里按边界、状态和验证要求稳定收敛”：

- 协议层定义 intake / clarify / observe / verify / report 行为约束
- CLI 层提供 init / status / state / verify / report / gate / audit 最小工具链
- 项目侧通过少量配置接入 protected paths、风险规则和宿主适配

## Quick Start

### 1. 只用协议，不装 CLI

适合只需要 L2 行为约束的场景。

做法：

1. 把 [full.md](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/rules/full.md) 或 [base.md](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/rules/base.md) 的内容复制到项目的 `CLAUDE.md`、`AGENTS.md` 或 `GEMINI.md`
2. 按需引用 [templates](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/templates) 和 [schemas](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/schemas)
3. 需要宿主接入示例时，查看 [adapters](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/adapters)

获得能力：

- intake / clarify / observe / verify / report 规则
- 任务模板与 schema
- Claude Code / Codex / Gemini CLI 的规则注入示例

### 2. 用 CLI 初始化项目

当前仓库内可直接本地运行：

```bash
node packages/cli/bin/agent-harness.js init --dry-run
node packages/cli/bin/agent-harness.js init --host codex
node packages/cli/bin/agent-harness.js status
```

如果当前项目使用 Codex，当前仓库已经通过项目级 `.codex/config.toml` 默认开启 `codex_hooks`。显式传参仍然可用：

```bash
codex
codex exec "继续推进当前任务"
```

未来发布后的默认入口会是：

```bash
npx @agent-harness/cli init
npx @agent-harness/cli init --protocol-only
```

说明：

- 仓库当前尚未发布到 npm，README 中的 `npx` 入口是目标分发形态
- 本地运行要求 `Node.js >= 18`

## 当前能力

`packages/cli` 当前已经具备以下 MVP 命令：

- `init`
- `status`
- `task`
- `state`
- `verify`
- `report`
- `gate`
- `audit`

这些命令当前覆盖的能力边界是：

- 初始化 `harness.yaml`、规则块、任务模板与最小运行时目录
- 维护本地 JSON 状态文件和 active task
- 执行最小完成门禁检查
- 生成任务报告
- 对写入动作执行最小 before-tool 门禁
- 记录并读取最小审计日志
- 提供 `.codex/hooks.json` 的最小自动 intake 接入点

## 在本仓库中使用 Codex Hooks

当前仓库已经内置以下文件：

- `.codex/hooks.json`
- `.codex/hooks/user_prompt_submit_intake.js`
- `.codex/hooks/session_start_restore.js`

启用方式：

```bash
codex
```

或：

```bash
codex exec "你的任务描述"
```

当前接入行为：

- `SessionStart`：恢复当前 `active task` 摘要
- `UserPromptSubmit`：自动判断是续写、新任务还是先澄清
- 高风险且归属不明的 prompt 会被直接阻断

降级路径：

- 自动 intake 失败时，hook 会 fail-open，不阻塞正常会话
- 失败提示会明确说明“已降级到手动模式”以及下一步 fallback 命令
- 需要人工补录时，执行 `node packages/cli/bin/agent-harness.js task intake "任务描述"`
- 需要人工切换任务时，执行 `node packages/cli/bin/agent-harness.js task suspend-active --reason "原因"`

说明：

- 当前仓库通过 `.codex/config.toml` 默认设置 `features.codex_hooks = true`
- 若项目未被 Codex 视为 trusted project，可继续显式使用 `--enable codex_hooks`
- 可执行 `npm run codex:hooks:check` 做语法自检，执行 `npm run codex:hooks:status` 查看当前仓库的 Codex hooks 接入状态

还未完成的重点不是“再加新命令”，而是：

- 更深的宿主 hooks 集成
- 发布流程与包分发收口
- 过渡命名收敛

当前交付边界：

- `commit`：允许通过显式请求触发，并推荐由 skill 承载
- `push`：保留为人工动作，不作为 skill 默认能力

## 包边界

### `@agent-harness/protocol`

负责：

- `rules/`
- `schemas/`
- `templates/`
- `adapters/`

不负责：

- 初始化项目
- 状态写入
- 审计写入
- 执行门禁逻辑

这意味着 `protocol` 可以单独传播和使用，不依赖 CLI。

### `@agent-harness/cli`

负责：

- `init`
- `status`
- `state`
- `verify`
- `report`
- `gate`
- `audit`

约束：

- `cli` 可以依赖 `protocol`
- `protocol` 不能反向依赖 `cli`
- 协议规则、模板和 schema 不应只存在于 CLI 内部副本中

## v0.1 发布范围

`v0.1` 的目标是先把“首次接入”和“最小闭环”做扎实，而不是一次性补齐所有长期能力。

`v0.1` 包含：

- `protocol` 独立分包
- `cli` 的 `init/status/state/verify/report/gate/audit` MVP
- 本地文件系统状态持久化
- 基础宿主接入样板

`v0.1` 不包含：

- `update` 命令
- 复杂升级器或深度 merge
- 完整宿主自动化 hooks 管理
- Homebrew / 二进制分发

`update` 被明确延后，原因很直接：当前优先级是先稳定首装、初始化、状态闭环和验证闭环，而不是处理跨版本升级。

## 仓库结构

```text
.
├── docs/           # 设计文档与 ADR
├── packages/
│   ├── protocol/   # 规则、schema、模板、adapter 示例
│   └── cli/        # Node.js CLI
├── harness/        # 运行时状态、schema、模板与报告
└── package.json    # workspace 根配置
```

## 当前约束

- `harness.yaml` 仍是过渡配置名
- 状态文件仍位于 `harness/` 目录
- 对外主叙事已切换到 Node.js + npm / npx

## 参考文档

- [Agent Harness 设计文档 v0.3](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-03-agent-harness-design-v0.3.md)
- [Agent Harness 开源架构 ADR v0.1](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-02-agent-harness-open-source-architecture-adr-v0.1.md)
- [Codex 自动 Intake 设计稿 v0.1](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-03-codex-auto-intake-design-v0.1.md)
- [Codex Hooks 开发流接入说明](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-03-codex-hooks-workflow-v0.1.md)
- [Codex 链路 v0.3 实施 Roadmap](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-04-codex-v0.3-roadmap.md)
- [CHANGELOG 维护规范 v0.1](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-04-changelog-maintenance-policy-v0.1.md)
- [Task Core 误判样本记录流程](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-03-task-core-misclassification-fixture-workflow-v0.1.md)
- [CLI README](/Users/lijianfeng/code/pp/agent-harness/packages/cli/README.md)
- [Protocol README](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/README.md)
