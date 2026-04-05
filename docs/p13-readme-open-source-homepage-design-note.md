# Design Note: 重写开源首页 README，并新增英文版 README.en.md

## 背景

- task_id: `p13-readme-open-source-homepage`
- intent: `feature`
- risk_level: `low`

## 目标

- 重写开源首页 README，并新增英文版 README.en.md

## 作用范围

- README.md
- README.en.md
- CHANGELOG.md

## 方案

- 把根 README 从“内部阶段性说明”改写为“外部开发者第一次打开仓库就能理解和上手”的开源首页。
- 首页信息架构统一收敛为：
  - 项目定位
  - Why agent-harness
  - Protocol only / Protocol + CLI
  - Quick Start
  - Codex 当前支持
  - 当前能力与边界
  - 仓库结构
  - 文档入口
- 新增英文版 `README.en.md`，并在两份 README 顶部互链，保证双语用户都能独立进入主路径。
- README 中明确区分“当前可用”与“未来目标入口”，避免把 `npx @agent-harness/cli` 写成已发布事实。

## 风险与权衡

- 如果 README 继续沿用内部说明结构，开源用户第一次进入仓库时会找不到真正的接入路径。
- 双语 README 会增加维护成本，但对面向全球开发者的项目属于必要成本。
- 这次只重写首页，不顺手扩展其他文档，先优先解决“外部用户如何理解和接入”的主问题。

## 验证计划

- 确认 `README.md` 与 `README.en.md` 都存在
- 确认两份文档顶部互链存在
- 确认两份文档都包含 `Quick Start`、`Codex`、`Protocol only / Protocol + CLI`
- 确认本地 CLI 路径和未来 `npx` 入口表述与当前仓库事实一致
