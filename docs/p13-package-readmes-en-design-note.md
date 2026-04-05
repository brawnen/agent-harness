# Design Note: 新增 packages/cli 和 packages/protocol 的英文 README，补齐包级开源入口说明

## 背景

- task_id: `p13-package-readmes-en`
- intent: `feature`
- risk_level: `low`

## 目标

- 新增 packages/cli 和 packages/protocol 的英文 README，补齐包级开源入口说明

## 作用范围

- packages/cli/README.en.md
- packages/protocol/README.en.md
- CHANGELOG.md

## 方案

- 为 `packages/cli` 和 `packages/protocol` 各自新增一份英文 README，不改现有中文版。
- 两份英文 README 都保留一个回到中文版的入口链接，降低双语维护时的迷路成本。
- 内容结构按“包是什么、现在能做什么、边界是什么、怎么使用”来组织，而不是简单复制根 README。
- `packages/cli/README.en.md` 重点覆盖：
  - CLI 的职责
  - 当前命令范围
  - Codex 支持现状
  - `PreToolUse` 的 Bash 高置信路径识别边界
- `packages/protocol/README.en.md` 重点覆盖：
  - rules / schemas / templates / adapters 的职责
  - protocol-only 的典型使用方式
  - protocol 与 CLI 的依赖边界

## 风险与权衡

- 双语 README 会提高维护成本，但对面向全球开发者的开源项目属于必要成本。
- 这次只补英文包 README，不同步重写中文包 README，优先保证外部开发者进入包目录时有清晰英文入口。
- 包级 README 只承诺当前仓库已经实现的能力，不提前承诺 npm 发布或更深宿主集成。

## 验证计划

- 确认两个英文 README 文件都存在
- 确认顶部包含回到中文版的链接
- 确认 `packages/cli/README.en.md` 包含 `Current Coverage`、`Codex Support`、`npx @agent-harness/cli init`
- 确认 `packages/protocol/README.en.md` 包含 `rules / schemas / templates / adapters`
