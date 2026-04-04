# Agent Harness 设计文档 v0.3

## 1. 状态

Current Baseline

这份文档是当前 `agent-harness` 的主设计文档，用于替代早期的：

- `Harness 设计文档 v0.1`
- `Harness 设计说明书 v0.2`

它不是单纯的理论目标文档，而是基于当前已经落地的实现重新收敛后的设计基线。

## 2. 设计结论

`agent-harness` 的正确定位不是新的 agent 平台，也不是新的 IDE 或 runtime，而是一套让 agent 在真实项目里稳定收敛的协议与工具层。

一句话定义：

`agent-harness = protocol + local state machine + delivery gates + host adapters`

当前项目的真实形态是：

- `protocol` 负责规则、schema、模板与宿主接入示例
- `cli` 负责初始化、状态、验证、报告、门禁、审计与最小任务内核
- 宿主接入先以 `Codex` 为突破口，通过 repo-local hooks 接入最小自动 intake
- 复杂宿主能力采用“目标架构正确 + 当前能力分级降级”的策略

## 3. 从 v0.1 / v0.2 继承了什么

### 3.1 从 v0.1 继承的原则

- `Protocol First`
- `Project-Light`
- `Convergence Before Automation`
- 任务必须有结构化状态，而不是只靠自然语言漂移

### 3.2 从 v0.2 继承的原则

- `Agent First`
- `Human-Natural, Machine-Structured`
- `Deterministic Where Possible`
- `Graceful Degradation`
- 按 `agent-native` 目标设计，但接受当前宿主能力不足的现实

## 4. 与早期设计相比，哪些地方已经改变

### 4.1 Skill Adapter 不再是架构中心

早期设计把 `Skill Adapters` 放在主架构层，但当前实现证明，真正的中心不是 skill，而是：

- `Task Draft`
- `State`
- `Verify / Report / Gate / Audit`
- `Host Hooks`

因此 skill 更适合作为交付动作和项目工作流的承载层，而不是 `agent-harness` 的第一层核心对象。

### 4.2 当前主线是 Node CLI，而不是内部 Ruby 工具

开源前重构已经明确：

- Ruby 不再是主线实现
- Node.js CLI 是唯一主线实现
- 分发路径以 `npm / npx` 为中心

### 4.3 当前实现不是“完整 agent-native”，而是“协议 + 本地状态机 + 最小宿主接入”

当前已经落地的并不是完整语义级硬门禁，而是：

- L2 规则约束
- 本地文件状态机
- 最小 `Codex` hook 接入
- 最小 `gate / verify / audit / report` 闭环

## 5. 当前总体架构

## 5.1 Protocol Layer

位置：

- [packages/protocol](/Users/lijianfeng/code/pp/agent-harness/packages/protocol)

职责：

- 发布规则文本
- 发布 JSON Schema
- 发布任务模板
- 发布宿主适配示例

关键内容：

- `rules/`
- `schemas/`
- `templates/`
- `adapters/`

协议层可独立传播和使用，不依赖 CLI。

## 5.2 CLI Layer

位置：

- [packages/cli](/Users/lijianfeng/code/pp/agent-harness/packages/cli)

职责：

- `init`
- `status`
- `task`
- `state`
- `verify`
- `report`
- `gate`
- `audit`

CLI 是工具层，不是协议层前置条件。

## 5.3 Runtime State Layer

位置：

- [harness/state](/Users/lijianfeng/code/pp/agent-harness/harness/state)
- [harness/audit](/Users/lijianfeng/code/pp/agent-harness/harness/audit)
- [harness/reports](/Users/lijianfeng/code/pp/agent-harness/harness/reports)

职责：

- 本地任务状态持久化
- 审计日志持久化
- 结构化报告输出

## 5.4 Host Adapter Layer

当前宿主适配状态：

- `Codex`：已接入 repo-local hooks
- `Claude Code`：当前仍主要依赖规则注入与 CLI
- `Gemini CLI`：当前仍主要依赖规则注入与 CLI

当前 `Codex` 已接的 hooks：

- `SessionStart`
- `UserPromptSubmit`

## 6. 核心对象模型

## 6.1 Task Draft

`Task Draft` 是 intake 阶段的结构化对象，用来承接自然语言输入的第一轮收敛。

当前最小字段：

- `source_input`
- `intent`
- `goal`
- `scope`
- `acceptance`
- `constraints`
- `assumptions`
- `open_questions`
- `risk_signals`
- `context_refs`
- `next_action`
- `mode`

当前实现状态：

- 已落地
- 由 `task intake` 和 `Codex UserPromptSubmit` 自动生成
- 字段不足时进入 `needs_clarification`

## 6.2 Confirmed Contract

`Confirmed Contract` 仍然是目标对象，但当前不是主线实现中心。

当前事实是：

- `Task Draft` 已经在承担大部分合同职责
- `Confirmed Contract` 还没有形成完整的独立收敛链路

因此在当前版本中，应将其视为后续增强位，而不是已完成核心。

## 6.3 Phase Model

统一阶段保持不变：

1. `intake`
2. `clarify`
3. `plan`
4. `execute`
5. `verify`
6. `report`
7. `close`

当前实现重点：

- `intake`
- `verify`
- `report`
- `close`

## 6.4 State Model

统一状态保持为：

- `draft`
- `needs_clarification`
- `planned`
- `in_progress`
- `blocked`
- `verifying`
- `done`
- `failed`
- `suspended`

当前状态机已经在 CLI 中落地，具备最小合法迁移约束。

## 6.5 Evidence Model

当前已使用的证据类型包括：

- `command_result`
- `test_result`
- `reasoning_note`
- `manual_confirmation`
- `gate_violation`

其中：

- `verify` 消费证据
- `report` 汇总证据
- `audit` 记录 override 与 gate 相关事件

## 6.6 Report Contract

`report` 阶段必须输出结构化报告，至少包括：

- `task_id`
- `intent`
- `conclusion`
- `actual_scope`
- `scope_deviation`
- `evidence_summary`
- `remaining_risks`
- `overrides_used`
- `next_steps`
- `completed_at`

当前已落地到：

- [report.js](/Users/lijianfeng/code/pp/agent-harness/packages/cli/src/commands/report.js)

## 7. Gate Levels 与当前落地方式

`agent-harness` 当前继续采用分级落地：

- `L2`：规则与自然语言约束
- `L1.5`：宿主 hook 与本地状态机结合的最小约束
- `L1`：完整语义级硬门禁，当前尚未实现

当前真实状态：

- `Codex` 的 `SessionStart` / `UserPromptSubmit` 已提供最小自动 intake
- `gate before-tool` 提供最小确定性门禁
- 完整语义级执行阻断仍然不可用

## 8. 当前已实现能力

当前已实现的能力以 `Node CLI + Codex hooks` 为主：

- Node CLI 初始化项目
- 检查项目接入健康状态
- 从自然语言创建任务
- 挂起当前 active task
- 维护本地状态文件
- 任务完成前验证门禁
- 生成结构化报告
- 记录最小审计日志
- 执行最小 before-tool 门禁
- `Codex` 自动 intake 与 active task 恢复
- `task-core` 分类回归样本与回归脚本

## 9. 当前未实现或未完全实现的能力

以下能力仍属于未来目标，而非当前基线：

- `Confirmed Contract` 的完整收敛链路
- 完整宿主语义级硬门禁
- Claude Code / Gemini CLI 的同等级自动 hooks
- 通用 lifecycle hooks 框架
- 自动升级器与复杂 merge
- 基于真实样本持续增强的复杂分类器

## 10. Codex 接入现状

当前仓库已经内置：

- [hooks.json](/Users/lijianfeng/code/pp/agent-harness/.codex/hooks.json)
- [config.toml](/Users/lijianfeng/code/pp/agent-harness/.codex/config.toml)

当前行为：

- `SessionStart` 恢复 active task 摘要
- `UserPromptSubmit` 自动判断 `continue / new / clarify`
- 高风险且归属不明的输入会直接 block

当前限制：

- 仍依赖 `Codex` 支持 repo-local hooks
- 仍依赖 trusted project 场景读取项目级 `.codex/config.toml`
- `task-core` 分类规则仍以最小 heuristics 为基础

## 11. Task Core 分类策略

`task-core` 当前不是黑箱启发式，而是“最小规则 + 可解释结果 + 回归样本”的组合。

当前分类结果已统一输出：

- `type`
- `reason_code`
- `reason`
- `matched_signals`
- `confidence`
- `block`

当前已建立：

- 样本集：
  [task-core-classification.json](/Users/lijianfeng/code/pp/agent-harness/packages/cli/fixtures/task-core-classification.json)
- 回归脚本：
  [verify-task-core-classification.js](/Users/lijianfeng/code/pp/agent-harness/packages/cli/scripts/verify-task-core-classification.js)

后续规则演进原则：

- 先补 fixture
- 再改规则
- 没有真实误判样本时，优先观测，不急着增加复杂度

## 12. 交付收口与项目工件策略

这部分是 `v0.3` 相比早期设计新增的内容。

`agent-harness` 不只关心“任务有没有完成”，还关心“任务如何在仓库里收口”。

### 12.1 Commit / Push Policy

默认策略：

- `commit`：显式请求才执行
- `push`：显式请求才执行，且保留为人工动作

原因：

- `task complete` 不等于 `repo integrated`
- `repo integrated` 不等于 `remote published`
- `git commit` 和 `git push` 都属于仓库治理动作，不适合写死在 harness core

推荐承载方式：

- `commit`：由 project policy 定义是否允许，并可由 skill 执行具体动作
- `push`：由 project policy 提供 readiness 提示，但默认仍由人工执行

### 12.2 Changelog Policy

`CHANGELOG.md` 应被视为项目交付工件，而不是个人习惯。

推荐默认策略：

- `bug`
- `feature`
- `refactor`

这三类任务在对用户可见或影响仓库语义时，应要求更新 changelog。

`explore` 通常不要求写 changelog。

### 12.3 Design Note / ADR Policy

复杂任务不应默认全部自动生成设计文档，但以下情况应触发设计沉淀：

- 跨多个模块
- 修改公共契约
- 高风险
- 需要后续重复参考
- 明显属于架构决策

文档类型应区分：

- `design note`
  说明某个复杂功能或实现方案
- `ADR`
  记录某个关键架构取舍为什么这么选

`ADR` 的完整含义是：

- `Architecture Decision Record`

也就是“架构决策记录”。

## 13. Project Policy 的建议演进方向

后续建议把以下策略逐步显式写入项目配置：

- `delivery_policy.commit`
- `delivery_policy.push`
- `output_policy.changelog`
- `output_policy.design_note`

这些不属于当前必须落地的 CLI 能力，但已经属于当前设计的一部分。

## 14. 当前推荐工作流

在当前仓库中，推荐工作流为：

1. 用户自然语言提出任务
2. `Codex` 通过 hook 自动 intake，或手动执行 `task intake`
3. agent 依据规则完成 `clarify / plan / execute / verify / report`
4. 若任务复杂或属于架构决策，补 `design note` 或 `ADR`
5. 若任务对外可见，按项目策略更新 `CHANGELOG.md`
6. 若用户显式要求，再执行 `commit` 或 `push`

## 15. 文档分工

当前文档体系建议这样理解：

- `v0.1`：
  初始问题定义与 protocol-first 思路
- `v0.2`：
  agent-native 方向收敛
- `v0.3`：
  当前真实实现基线
- 开源 ADR：
  分包、分发、仓库结构
- Codex hooks 文档：
  宿主接入细节

## 16. 下一步演进

`v0.3` 之后的合理演进方向是：

1. 基于真实误判样本持续增强 `task-core`
2. 把 `CHANGELOG` / `design note` / `commit-ready` 策略逐步写进 project policy
3. 继续完善 `Codex` hooks
4. 评估 Claude Code / Gemini CLI 的同等级自动接入路径

相关配置草案见：

- [Harness Config Policy Extension Draft v0.1](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-03-harness-config-policy-extension-draft-v0.1.md)
- [Harness Config Schema v0.3 更新方案](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-04-harness-config-schema-v0.3-update-plan.md)
