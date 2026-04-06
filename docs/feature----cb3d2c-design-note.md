# Design Note: 实现 Gemini CLI 宿主接入的最小闭环，使 init/status/文档口径与当前真实能力一致。

## 背景

- task_id: `feature----cb3d2c`
- intent: `feature`
- risk_level: `low`

## 目标

- 实现 Gemini CLI 宿主接入的最小闭环，使 init/status/文档口径与当前真实能力一致。

## 作用范围

- packages/cli/src/commands/init.js
- packages/cli/src/commands/status.js
- packages/protocol/adapters/gemini-cli/**
- README.md
- docs/**
- GEMINI.md
- AGENTS.md

## 方案

- 保持 `Gemini CLI` 的真实能力边界，不引入不存在的原生 hooks。
- 在 `status` 中新增 `Gemini adapter` 检查项，明确输出它属于 `GEMINI.md` 驱动的 L2 接入，并根据是否存在 `.harness` 给出运行模式说明。
- 保持 `init --host gemini-cli` 的现有实现，不额外生成宿主 hooks 配置；文档改为明确说明 `init` 只生成 `GEMINI.md` managed rules block 与 `.harness` 运行时骨架。
- 同步仓库级 `GEMINI.md`、`README`、中英文使用指南和 Gemini adapter 说明，移除“Gemini CLI 仍是后续计划”这类过期表述。
- 在 `AGENTS.md` 增加 `Gemini CLI` 宿主接入协作偏好，和现有 `Claude Code` 规则保持一致。

## 风险与权衡

- `Gemini CLI` 没有原生 hooks，这次只能做到 L2 规则注入和 CLI 状态机闭环，不能承诺工具级自动拦截。
- `status` 仍然会对仓库里未注入 managed block 的宿主规则文件给出失败提示；这是当前仓库的既有状态，不在这次 Gemini 接入收口范围内顺手改动。
- 文档更新需要同时覆盖中英文，否则会出现“中文已支持、英文仍写 future work”的对外口径不一致。

## 验证计划

- `node --check packages/cli/src/commands/status.js`
- 在临时目录执行 `node /Users/lijianfeng/code/pp/agent-harness/packages/cli/bin/agent-harness.js init --host gemini-cli`
- 在同一临时目录执行 `node /Users/lijianfeng/code/pp/agent-harness/packages/cli/bin/agent-harness.js status`
