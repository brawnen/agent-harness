# Agent Harness 自举与跨项目接入指南 v0.1

[English](docs/2026-04-05-agent-harness-usage-guide-v0.1.en.md)

这份文档回答两个问题：

1. 如何把 `agent-harness` 用在 `agent-harness` 自己身上
2. 如何在你本机上的其他项目中接入 `agent-harness`

## 1. 在本项目中如何使用

当前仓库已经完成自举，核心组成是：

- [harness.yaml](harness.yaml)：项目策略入口
- [.harness/tasks](.harness/tasks)：任务模板
- [.harness/state](.harness/state)：任务状态
- [.harness/audit](.harness/audit)：审计日志
- [.harness/reports](.harness/reports)：完成报告
- [.codex/config.toml](.codex/config.toml)：Codex feature flag
- [.codex/hooks.json](.codex/hooks.json)：Codex hooks 接入

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

### 1.1 交互节奏约束

团队日常使用时，建议统一采用以下节奏：

- 确认前：先给方案，等待确认
- 确认后：直接执行，不重复上一轮完整方案
- 最终结果：只收口一次，不把中间总结原样再说一遍

这条规则适合写进宿主规则文件和项目约束，避免 agent 在长任务里反复复述同一套方案。

## 2. 在其他项目中如何使用

目前最现实的接入方式有两种。

### 2.1 Protocol only

适合：

- 只想先试规则
- 不想立刻接入 CLI
- 当前宿主没有完整 hooks

做法：

1. 把 [packages/protocol/rules/base.md](packages/protocol/rules/base.md) 或 [packages/protocol/rules/full.md](packages/protocol/rules/full.md) 复制到目标项目的 `AGENTS.md`、`CLAUDE.md` 或 `GEMINI.md`
2. 按需复制：
   - [packages/protocol/templates](packages/protocol/templates)
   - [packages/protocol/schemas](packages/protocol/schemas)
   - [packages/protocol/adapters](packages/protocol/adapters)

### 2.2 通过 npm 接入 CLI

这是现在最推荐的方式。

在目标项目目录下执行：

```bash
npx @brawnen/agent-harness-cli init --host codex
```

或者先安装到项目里：

```bash
npm install -D @brawnen/agent-harness-cli
npx agent-harness init --host codex
```

初始化完成后，常用命令是：

```bash
npx agent-harness status
npx agent-harness task intake "任务描述"
npx agent-harness verify
npx agent-harness report --conclusion "结论"
npx agent-harness delivery ready
```

如果你只想使用协议层，可以安装：

```bash
npm install -D @brawnen/agent-harness-protocol
```

### 2.3 直接复用当前仓库里的本地 CLI

如果你想直接复用源码仓库里的开发版本，这是最适合你自己和团队的方式。

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
3. 优先统一切到 `npx @brawnen/agent-harness-cli init`

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
- `Claude Code` 已支持 `CLAUDE.md + .claude/settings.json` 的最小闭环接入
- `Gemini CLI`、`Antigravity` 还在后续计划中
- `commit` 已支持显式本地交付
- `push` 仍然保持人工动作
- 当前已提供 npm 包，跨项目接入优先推荐 npm CLI

`Claude Code` 当前支持边界：

- `PreToolUse`：前置 `gate before-tool`
- `PostToolUse`：工具后 `state update`
- `CLAUDE.md` 继续承担 intake / clarify / completion gate 的 L2 规则约束
- 暂不具备 `Codex` 那样的 `SessionStart / UserPromptSubmit` 自动 intake / 恢复能力
