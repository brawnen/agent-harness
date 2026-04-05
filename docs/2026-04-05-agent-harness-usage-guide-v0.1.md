# Agent Harness 自举与跨项目接入指南 v0.1

[English](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-05-agent-harness-usage-guide-v0.1.en.md)

这份文档回答两个问题：

1. 如何把 `agent-harness` 用在 `agent-harness` 自己身上
2. 如何在你本机上的其他项目中接入 `agent-harness`

## 1. 在本项目中如何使用

当前仓库已经完成自举，核心组成是：

- [harness.yaml](/Users/lijianfeng/code/pp/agent-harness/harness.yaml)：项目策略入口
- [.harness/tasks](/Users/lijianfeng/code/pp/agent-harness/.harness/tasks)：任务模板
- [.harness/state](/Users/lijianfeng/code/pp/agent-harness/.harness/state)：任务状态
- [.harness/audit](/Users/lijianfeng/code/pp/agent-harness/.harness/audit)：审计日志
- [.harness/reports](/Users/lijianfeng/code/pp/agent-harness/.harness/reports)：完成报告
- [.codex/config.toml](/Users/lijianfeng/code/pp/agent-harness/.codex/config.toml)：Codex feature flag
- [.codex/hooks.json](/Users/lijianfeng/code/pp/agent-harness/.codex/hooks.json)：Codex hooks 接入

在本仓库内最小使用路径是：

```bash
codex
node packages/cli/bin/agent-harness.js status
node packages/cli/bin/agent-harness.js delivery ready
```

如果你不用 Codex 自动 hooks，也可以手动使用 CLI：

```bash
node packages/cli/bin/agent-harness.js task intake "任务描述"
node packages/cli/bin/agent-harness.js task confirm
node packages/cli/bin/agent-harness.js verify
node packages/cli/bin/agent-harness.js report --conclusion "结论"
node packages/cli/bin/agent-harness.js delivery commit
```

## 2. 在其他项目中如何使用

目前最现实的接入方式有两种。

### 2.1 Protocol only

适合：

- 只想先试规则
- 不想立刻接入 CLI
- 当前宿主没有完整 hooks

做法：

1. 把 [packages/protocol/rules/base.md](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/rules/base.md) 或 [packages/protocol/rules/full.md](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/rules/full.md) 复制到目标项目的 `AGENTS.md`、`CLAUDE.md` 或 `GEMINI.md`
2. 按需复制：
   - [packages/protocol/templates](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/templates)
   - [packages/protocol/schemas](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/schemas)
   - [packages/protocol/adapters](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/adapters)

### 2.2 直接复用当前仓库里的本地 CLI

在 npm 发布前，这是最适合你自己和团队的方式。

在目标项目目录下执行：

```bash
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js init --host codex
```

初始化完成后，常用命令是：

```bash
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js status
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js task intake "任务描述"
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js verify
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js report --conclusion "结论"
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js delivery ready
```

## 3. 推荐接入顺序

如果你要在本机的其他项目里推广，建议按这个顺序：

1. 先选一个你常用的 `Codex` 项目做完整 CLI 接入
2. 团队里其他项目先从 `protocol-only` 开始
3. 等 npm 发布后，再统一切到 `npx @agent-harness/cli init`

## 4. 什么时候用完整 CLI

建议使用完整 CLI 的情况：

- 你希望任务状态持久化
- 你希望有 `verify / report / delivery commit`
- 你希望接入 `Codex hooks`
- 你希望高风险写入在执行前被拦住

只建议用 `protocol-only` 的情况：

- 只是想先试规则约束
- 宿主暂时没有可用 hooks
- 不想在项目里引入 `.harness/` 运行时目录

## 5. 现在的边界

当前接入说明基于今天的真实实现：

- `Codex` 是支持最完整的宿主
- `Claude Code`、`Gemini CLI`、`Antigravity` 还在后续计划中
- `commit` 已支持显式本地交付
- `push` 仍然保持人工动作
- npm 还没有正式发布，所以跨项目接入当前以“本地 CLI 路径”最现实
