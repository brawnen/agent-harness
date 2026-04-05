# Harness 设计说明书 v0.2

> Status: Historical / Superseded
>
> 这份文档代表 `agent-harness` 向 `agent-native` 方向收敛的第二轮设计。
> 其中大量原则仍然有效，但实现状态与对象边界已被后续 Node CLI、Codex hooks 和开源分层方案修正。
> 当前主设计基线已切换到：
> [Agent Harness 设计文档 v0.3](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-03-agent-harness-design-v0.3.md)

## 1. 设计结论

Harness 不是一个给用户单独操作的外部工具，而是一个面向 agent 的任务收敛内核。

它的正确目标形态是：

- 用户只和 agent 自然语言交互
- agent 内部按 harness 的协议完成 intake、clarify、plan、execute、verify、report
- harness 用结构化状态、控制信号和门禁规则约束 agent 行为
- 项目只通过少量配置接入，不修改核心协议

一句话定义：

`Harness = 任务协议 + 交互收敛 + 状态模型 + 门禁规则 + 项目配置 + 宿主适配`

同时必须承认一个现实前提：

- `agent-native` 是唯一正确方向
- 当前主流 agent 平台还不支持完整语义级硬门禁
- 所以第一版必须采用"目标架构正确 + 实现分级降级"的策略

也就是说：

`目标按 native 设计，落地按 gate level 分层实现`

## 2. 要解决的问题

当前 agent 编程最大的问题不是"不会写"，而是"不会稳定收敛"：

- 用户输入是自然语言，目标、边界和完成标准常常不完整
- agent 缺少稳定的任务合同和状态对象
- tasks 在不同项目、不同 agent 之间不可迁移
- 项目约束、风险边界和验证要求没有统一接入层
- agent 输出经常只是自然语言总结，不是结构化状态和证据
- 即使写了规则，现有平台也未必能真正硬性阻断 agent 越界执行

Harness 的任务就是同时解决两类问题：

1. 协议问题
   如何把任务、状态、证据、门禁定义清楚
2. 集成问题
   如何把这些协议真正嵌到 agent 工作流里，而不是停留在文档

## 3. 设计目标与非目标

### 3.1 目标

第一版主目标：

- 用户继续自然语言交互，不填写 schema
- agent 内部自动生成 `Task Draft` 和 `Confirmed Contract`
- 统一 phase、state、evidence、report 的对象模型
- 统一 control signals 和门禁规则
- 允许项目通过 `harness.yaml` 接入默认模式、风险和验证规则
- 定义 host adapter 的最小契约
- 在当前平台能力下，通过 L2/L3 实现大部分约束，并为未来 L1 留接口

### 3.2 非目标

第一版不做：

- 新的 LLM runtime
- 新的 IDE 或新的 agent 前端
- 完整分布式多 agent orchestration
- 深度语言特化编译能力
- 全自动生成测试或验证脚本
- 假装当前平台已经具备完整语义级硬拦截

## 4. 核心原则

1. `Agent First`
   harness 必须先按 agent 内核设计，再考虑 CLI、plugin、MCP 等载体。
2. `Protocol First`
   先固定对象、状态、信号和门禁，再谈实现细节。
3. `Convergence Before Automation`
   先解决任务不收敛，再谈更强自动化。
4. `Human-Natural, Machine-Structured`
   对用户保持自然交互，对 agent 内部保持结构化状态。
5. `Deterministic Where Possible`
   能用确定性规则判断的，不交给 LLM 概率判断。
6. `Graceful Degradation`
   目标架构必须正确，但当前平台做不到的部分要显式降级，而不是假装已实现。
7. `Project-Light`
   项目接入成本必须低，最好是"增加配置 + 模板"，而不是改核心代码。

## 5. 总体架构

### 5.1 User Interaction Layer

用户只与 agent 自然语言交互。

约束：

- 用户不直接操作 harness
- 用户不填写 `Task Contract`
- 用户不显式管理 state
- 用户看到的是自然语言输出，而不是内部协议对象

### 5.2 Harness Core

Harness Core 是系统主体，负责：

- `intake`
- `task draft`
- `clarify policy`
- `task contract closure`
- `phase / state transition`
- `control signal generation`
- `execution gate`
- `completion gate`
- `evidence policy`
- `report contract`

### 5.3 Project Config

每个项目通过配置声明自己的差异：

- `default_mode`
- `allowed_paths`
- `protected_paths`
- `risk_rules`
- `default_commands`
- `task_templates`
- `skill_policy`
- `output_policy`

完整 schema 见：[harness-config.schema.json](./schemas/harness-config.schema.json)

### 5.4 Host Adapter

Host Adapter 把 Harness Core 接入具体宿主平台，例如：

- Codex
- Claude Code
- Gemini CLI

它负责：

- 映射宿主生命周期到 harness lifecycle hooks
- 执行状态持久化与恢复
- 暴露宿主能力声明
- 执行允许范围内的门禁

### 5.5 Reference Adapter

CLI、wrapper、MCP、plugin 都只是承载和适配形态。

它们可以存在，但不是架构中心。

## 6. 核心对象模型

### 6.1 Task Draft

`Task Draft` 是 intake 阶段的内部对象，用来承接自然语言到结构化任务的第一轮收敛。

最小字段：

- `source_input`
- `intent`
- `goal`
- `scope`
- `acceptance`
- `constraints`
- `mode`
- `assumptions`
- `open_questions`
- `risk_signals`
- `context_refs`
- `next_action`

作用：

- 承接自然语言
- 暂存推断与假设
- 标记阻断问题
- 决定下一步是 `clarify` 还是 `plan` 还是 `observe`

完整 schema 见：[task-draft.schema.json](./schemas/task-draft.schema.json)

### 6.2 Confirmed Contract

`Confirmed Contract` 是可以进入计划和执行的任务合同。

#### 6.2.1 必填字段

- `intent`
- `goal`
- `scope`
- `acceptance`

#### 6.2.2 可选字段

- `title`
- `constraints`
- `verification`
- `context_refs`

#### 6.2.3 派生字段

- `id`
- `mode`
- `risk_level`
- `evidence_required`

推导规则：

- `mode`：任务显式值优先，否则取项目默认
- `risk_level`：由 `scope` + `risk_rules` 推导，必要时要求确认
- `evidence_required`：由 `intent`、`risk_level`、`verification` 共同推导

### 6.3 Phase Model

统一阶段：

1. `intake`
2. `clarify`
3. `plan`
4. `execute`
5. `verify`
6. `report`
7. `close`

第一版的重心仍然是：

- `intake`
- `clarify`
- `plan`

### 6.4 State Model

统一状态：

- `draft`
- `needs_clarification`
- `planned`
- `in_progress`
- `blocked`
- `verifying`
- `done`
- `failed`
- `suspended`

最小状态附带信息：

- `current_phase`
- `current_state`
- `assumptions`
- `confirmed_scope`
- `open_questions`
- `selected_skill`
- `next_action`

完整 schema 见：[task-state.schema.json](./schemas/task-state.schema.json)

### 6.5 Evidence Model

统一证据类型：

- `command_result`
- `test_result`
- `diff_summary`
- `artifact`
- `reasoning_note`
- `manual_confirmation`
- `audit_log`

其中 `audit_log` 用于记录 override、门禁违规和补救动作。

### 6.6 Audit Log Model

`audit_log` 是 v0.2 新增的结构化审计对象，不同于其他证据类型，它专门记录门禁被绕过或违规的过程。

每条审计记录至少包含：

- `event_type`：`force_override` / `gate_violation` / `remediation` / `state_recovery` / `manual_confirmation`
- `task_id`
- `phase`：事件发生的阶段
- `signal`：触发此事件的控制信号，例如 `block_execution`
- `description`：被跳过的门禁、违规内容或补救措施
- `user_input`：触发 override 的用户原文，非 override 事件可为 null
- `risk_at_time`：事件发生时的风险等级
- `timestamp`

审计日志存储位置：`harness/audit/<task_id>.jsonl`，每行一条记录。

完整 schema 见：[audit-log.schema.json](./schemas/audit-log.schema.json)

### 6.7 Report Contract

任务进入 `report` 阶段后，必须输出结构化报告，不得只输出自然语言总结。

报告必须包含：

- `task_id`
- `intent`
- `conclusion`：根因判断（bug）、交付内容（feature）、调研结论（explore）
- `actual_scope`：实际改动或分析范围
- `scope_deviation`：与合同 scope 的偏差说明，无偏差时为 null
- `evidence_summary`：验证证据的摘要列表
- `remaining_risks`：剩余风险，无则为空数组
- `overrides_used`：本次任务中使用的 force_override 摘要
- `next_steps`：下一步建议
- `completed_at`

报告存储位置：`harness/reports/<task_id>.json`

完整 schema 见：[report.schema.json](./schemas/report.schema.json)

## 7. 生命周期与状态流转

### 7.1 Lifecycle Hooks

第一版统一定义以下 hooks：

- `on_user_input`
- `before_plan`
- `before_execute`
- `after_execute`
- `before_completion`
- `before_agent_reply`（`future_placeholder`，当前不可达，详见 §10.3）

`before_agent_reply` 需要在 LLM 生成回复之前拦截，当前主流平台均无此能力。第一版不实现此 hook，保留为未来平台能力演进时的接入点。adapter 实现时不需要为它预留调用位置，但 `capabilities()` 声明中需标注 `can_intercept_response: false`。

### 7.2 最小状态迁移

1. `draft -> needs_clarification`
   必填字段未闭合，或存在阻断问题
2. `draft -> planned`
   合同已闭合，可制定计划
3. `planned -> in_progress`
   计划已选定，进入执行
4. `in_progress -> blocked`
   遇到外部依赖、权限或关键信息缺口
5. `in_progress -> verifying`
   执行动作已完成，开始验证
6. `verifying -> done`
   最小验证和证据要求满足
7. `verifying -> failed`
   验证失败且当前无接受路径
8. `any -> suspended`
   任务主动暂停

### 7.3 多任务相关状态

v0.2 明确支持任务切换，因此补充约束：

- 每个任务必须有 `task_id`
- 新输入默认先尝试映射到当前活跃任务
- 无法映射时，新建任务并将当前任务置为 `suspended`
- 用户显式切换任务时，必须先持久化当前状态

### 7.4 `observe` 动作语义

`next_action: observe` 表示当前任务无法直接进入 `plan`，需要先执行只读的信息收集动作，再决定是否能闭合合同。

触发条件：

- `scope` 已有方向但无法落到具体模块，需要先阅读代码才能确认边界
- 存在依赖外部资源的前置问题，需先确认资源状态
- `intent` 为 `explore` 且目标是阅读或分析，不涉及执行

行为规则：

- `observe` 阶段只允许只读动作（读文件、搜索、阅读日志）
- 不允许修改文件、运行有副作用的命令
- observe 结束后必须更新 `task_draft`，重新判断 `next_action`
- observe 的结果必须挂载为 `reasoning_note` 类型的 evidence

状态流转：

`draft --observe--> draft`（更新后重新判断）
`draft --observe 结果充分--> planned`
`draft --observe 仍有阻断--> needs_clarification`

## 8. 交互收敛规则

### 8.1 Intake Rule

自然语言首先进入 `Task Draft`，由 agent 自动推断：

- `intent`
- `goal`
- `scope`
- `acceptance`
- `constraints`

### 8.2 Clarify Rule

只有在以下情况才追问：

- `scope` 不清，可能越界
- `acceptance` 不清，无法判断完成
- 存在高成本路径分叉
- 命中高风险
- 任务依赖外部资源或权限

### 8.3 Interaction Rule

每轮只允许一个最高价值问题。

用户可见输出应至少隐含表达：

- 我的理解
- 当前假设
- 唯一阻断问题
- 下一步动作

### 8.4 Force Override

`force_override` 规则：

- 用户可显式要求跳过某个门禁
- agent 可继续，但必须记录到 `audit_log`：
  - 被跳过的门禁（signal）
  - 用户确认语句（user_input）
  - 当前风险等级（risk_at_time）
  - 审计时间（timestamp）

`force_override` 不能跳过：

- 文件系统或平台硬权限限制
- `protected_paths` 写入限制

`force_override` 可以跳过：

- clarify 追问
- 高风险确认提示
- 某些非强制验证要求

## 9. 控制信号模型

### 9.1 最小控制信号集合

- `ask_one_question`
- `proceed_to_plan`
- `block_plan`
- `proceed_to_execute`
- `block_execution`
- `require_confirmation`
- `require_verification`
- `allow_completion`
- `block_completion`
- `force_override`

### 9.2 控制信号来源分层

v0.2 明确把控制信号分成两类。

#### 9.2.1 确定性信号

由代码根据结构化状态产生，优先做硬门禁：

- 必填字段缺失 -> `block_plan`
- 必填字段完整 -> `proceed_to_plan`
- 命中 `risk_rules` -> `require_confirmation`
- 必需 evidence 缺失 -> `block_completion`
- 最小验证通过 -> `allow_completion`

#### 9.2.2 语义性信号

由 LLM 或语义判断产生，在当前平台主要做 L2 约束：

- `scope` 是否足够具体 -> `ask_one_question`
- `acceptance` 是否可执行 -> `ask_one_question`
- 某次行动是否实质越出当前边界 -> `block_execution`

### 9.3 控制信号优先级

当多个信号同时出现时，按以下顺序处理：

`block_execution > block_plan > block_completion > require_confirmation > ask_one_question > proceed_* > allow_completion`

## 10. 三级门禁模型

这是 v0.2 相比 v0.1 最重要的落地补充。

### 10.1 门禁级别

| 级别 | 名称 | 机制 | 作用 |
|---|---|---|---|
| `L1` | 硬门禁 | 平台原生拦截 + 外部/内置确定性判断 | 真正阻止动作发生 |
| `L2` | 协议门禁 | system prompt + structured output + schema 校验 | 高概率约束 |
| `L3` | 观察门禁 | 事后审计、违规标记、人工复核 | 追溯和改进 |

### 10.2 当前现实结论

在当前主流 agent 平台上：

- `L2` 和 `L3` 立即可用
- `L1` 仅在部分 tool-level hook 上可部分实现
- 完整语义级 `L1` 仍不可达

### 10.3 各 hook 的当前可达级别

| hook | 目标级别 | 当前可达 | 说明 |
|---|---|---|---|
| `on_user_input` | L1 | L2 | prompt 规则约束 |
| `before_agent_reply` | L1 | 不可达 | 当前无平台支持，标记为 future_placeholder |
| `before_plan` | L1 | L2 | LLM 自行判断，无法硬拦截 |
| `before_execute` | L1 | L1（部分）+ L2 | PreToolUse hook 可做工具级拦截，无法做语义级判断 |
| `after_execute` | L3 | L3，部分平台可做 L1 记录 | PostToolUse hook |
| `before_completion` | L1 | L2 | LLM 自行判断，无法硬拦截 |

### 10.4 设计要求

任何控制信号都必须声明：

- 目标门禁级别
- 当前可达门禁级别
- 不可达时的 fallback 行为
- 违规时的审计动作

## 11. 执行门禁与完成门禁

### 11.1 执行门禁

以下情况不得直接执行：

- `intent / goal / scope / acceptance` 未闭合
- 当前存在未处理阻断问题
- 当前动作超出 `scope`
- 命中高风险范围但未确认
- 当前任务处于 `needs_clarification`

### 11.2 完成门禁

以下情况不得宣称完成：

- 没有满足最小验证要求（见 §16 验证矩阵）
- 必需 evidence 未挂载
- acceptance 与结果不匹配
- 当前仍存在未关闭阻断问题

### 11.3 违规补救

若 agent 实际违反门禁：

- 记录 `audit_log`（event_type: gate_violation）
- 标记任务进入 `blocked` 或 `verifying`
- 输出补救建议
- 必要时要求人工确认继续

## 12. 状态持久化与恢复

### 12.1 持久化位置

仓库内约定以下目录结构：

```
harness/
  state/
    index.json          # 任务索引，记录所有任务的当前状态
    tasks/
      <task_id>.json    # 单个任务的完整状态
  audit/
    <task_id>.jsonl     # 审计日志，每行一条
  reports/
    <task_id>.json      # 任务完成报告
```

`index.json` 完整 schema 见：[state-index.schema.json](./schemas/state-index.schema.json)

### 12.2 持久化内容

每个任务状态文件至少包含：

- `task_id`
- `task_draft`
- `confirmed_contract`
- `current_phase`
- `current_state`
- `evidence`
- `open_questions`
- `override_history`
- `created_at`
- `updated_at`

完整 schema 见：[task-state.schema.json](./schemas/task-state.schema.json)

### 12.3 恢复规则

- agent 启动时优先恢复未完成任务（从 index.json 读取 active_task_id）
- 若上下文压缩导致状态丢失，以持久化文件为准
- 若状态文件损坏或 schema_version 不匹配，进入 `blocked` 并要求恢复确认

### 12.4 State 文件的仓库管理策略

state 文件默认应加入 `.gitignore`，原因：

- 任务状态是本地会话产物，频繁变更会产生大量 commit 噪音
- 多人协作时 state 文件可能产生合并冲突
- state 不是代码资产，不需要版本追踪

建议在仓库根目录的 `.gitignore` 中添加：

```
harness/state/
harness/audit/
```

例外规则：

- `harness/reports/` 可选择性 commit，作为任务完成记录归档
- 如需跨设备共享进行中的任务，可手动 commit state 文件，但不作为默认行为

### 12.5 Schema 版本迁移策略

每个持久化文件头部都有 `schema_version` 字段。

第一版约定：

- 当前版本为 `"0.2"`
- 读取到 schema_version 与当前 harness 版本不匹配时，不尝试自动迁移
- 直接丢弃旧 state，以 `state_recovery` 类型写入 audit_log，然后重新进入 intake
- 用户会看到提示："发现旧版本任务状态（v0.x），已重置，请重新描述任务"

第一版不保证跨版本兼容，这是有意为之的简化决定，待 schema 稳定后再引入迁移工具。

## 13. 多任务与任务切换

v0.2 明确把多任务视为第一版必须考虑的现实场景。

### 13.1 任务识别

- 每次 `on_user_input` 先判断是否属于当前任务
- 若明显是新任务，则生成新 `task_id`
- 若同时提到多个任务，默认拆分，并把额外任务标记为 `draft`

### 13.2 切换规则

- 切换前必须持久化当前任务
- 新任务进入时，旧任务默认 `suspended`
- 用户可显式恢复某个 `task_id`

### 13.3 当前任务判定

第一版可按以下信号综合判断：

- 是否延续上轮目标
- 是否引用同一模块、错误、文件或上下文
- 是否显式使用"另外一个问题""顺便""回到刚才"等切换词

### 13.4 任务判定 Fallback

当 agent 无法确定输入属于当前任务还是新任务时（置信度低），不允许静默判定。

Fallback 规则：

1. agent 输出简短确认："你说的是刚才 XXX 的任务，还是一个新问题？"
2. 用户确认后，再更新 task_draft 或新建任务
3. 若用户回答仍然不明确，默认新建任务，旧任务 suspended

错误归并的后果：

- 旧任务 scope 被新输入污染
- 确定性信号基于错误的 task_draft 判断，导致门禁失效

因此置信度低时宁可多问一句，不允许静默猜测。

## 14. Project Config 设计

### 14.1 必需配置

- `project_type`
- `default_mode`
- `allowed_paths`
- `protected_paths`
- `default_commands`
- `risk_rules`

### 14.2 可选配置

- `languages`
- `task_templates`
- `skill_policy`
- `output_policy`

完整 schema 见：[harness-config.schema.json](./schemas/harness-config.schema.json)

### 14.3 冲突规则

统一优先级：

`task explicit value > project config > core default`

关键约束：

- `protected_paths` 高于 `allowed_paths`
- `task_templates` 只能补默认，不覆盖任务显式值
- `risk_rules` 用于推导风险，不替代人工判断

### 14.4 Task Template 如何参与 Intake

`task_templates` 配置项定义两个参数：

- `directory`：模板文件目录，默认 `harness/tasks/`
- `inject_phase`：注入时机，`intake` 或 `contract_closure`

**`intake` 注入模式（推荐）**

模板作为 LLM 推断的辅助上下文注入，类似 few-shot 示例。

作用：引导 LLM 对不同 intent 类型的任务给出更准确的字段推断，例如 bug 任务应包含"触发条件"和"预期行为"。

不作用：不强制要求 task_draft 包含模板中的所有字段。

**`contract_closure` 注入模式**

模板作为字段默认值注入，在 task_draft 升级为 confirmed_contract 时补全缺失的可选字段。

作用：自动填入 mode、evidence_required 等派生字段的默认值。

不作用：不覆盖 task_draft 中已有的显式值。

**优先级规则**：

`用户显式输入 > task_draft 推断值 > template 默认值 > core default`

## 15. Skill Adapter 与执行策略

### 15.1 Adapter 字段

- `skill_name`
- `supported_intents`
- `supported_modes`
- `preferred_phases`
- `priority`
- `exclusive`
- `requires_inputs`
- `produces_outputs`
- `risk_notes`
- `verification_expectation`

### 15.2 选择规则

统一按：

`match -> validate -> score -> select`

### 15.3 冲突解决

统一优先级：

`task explicit override > project skill_policy > adapter priority > core fallback`

第一版约束：

- 默认一个阶段只选一个主执行策略
- 主执行策略可以是 skill，也可以是 no-skill workflow

## 16. 验证矩阵

按 intent 定义最小验证要求，完成门禁基于此矩阵判定。

| intent | 最小验证要求 | 最低 evidence 类型 | 判定类型 |
|---|---|---|---|
| `bug` | 至少一条命令或测试证明问题不再复现 | `command_result` 或 `test_result` | 确定性（退出码） |
| `feature` | 至少一条命令或验证动作证明新能力可运行 | `command_result` | 确定性（退出码） |
| `explore` | 至少有结论、依据、风险与下一步建议 | `reasoning_note` | 语义性（LLM 判断） |
| `refactor` | 至少有一条证明行为未破坏的验证结果 | `test_result` | 确定性（退出码） |
| `prototype` | 可无强制自动验证，但必须明确未验证范围 | `reasoning_note`（标注未验证） | 标记即可 |

说明：

- "确定性"判定：由退出码或 `passed` 字段决定，不依赖 LLM 解读
- "语义性"判定：由 LLM 判断 `reasoning_note` 内容是否包含结论和依据，属于 L2 约束
- `prototype` 不强制验证，但必须在 report 的 `remaining_risks` 中注明未验证范围

## 17. Host Adapter 最小接口契约

Host Adapter 必须实现最小契约，而不是只写职责描述。

```text
HostAdapter
  on_user_input(input) -> intake_result
  before_tool_call(tool, args) -> gate_result
  after_tool_call(tool, result) -> state_update
  before_completion(task_id) -> completion_result
  get_state(task_id) -> harness_state
  set_state(task_id, state) -> void
  persist_state(task_id) -> void
  restore_state(task_id) -> harness_state
  capabilities() -> adapter_capabilities
```

其中 `adapter_capabilities` 至少声明：

- `can_intercept_tool_call`：是否支持工具级拦截（对应 before_execute L1）
- `can_intercept_response`：是否支持回复级拦截（对应 before_agent_reply，当前均为 false）
- `can_persist_state`：是否支持状态持久化
- `can_run_external_process`：是否支持调用外部 harness 进程
- `gate_level`：当前宿主能达到的最高门禁级别（`L1` / `L2` / `L3`）

作用：

- 让 Harness Core 知道当前宿主能做到的门禁级别
- 自动决定采用 L1、L2 还是 L3 的降级路径
- 在 capabilities 约束下选择最强可用的信号执行方式

## 18. 当前可落地范围

基于现有平台能力，当前最现实的落地方向是：

### 18.1 立即可做

- `Task Draft` / `Confirmed Contract` 结构化输出
- intake / clarify 规则
- project config 接入
- state 持久化
- skill adapter 选择
- L2 协议门禁
- L3 审计门禁

### 18.2 部分可做

- tool-level `before_execute` 拦截（Claude Code PreToolUse hook）
- 外部 harness 进程配合宿主 hook 做局部 L1

### 18.3 暂不可做

- response-level `before_agent_reply` 硬拦截
- 完整语义级 `before_plan` / `before_completion` 硬门禁

## 19. 推荐实现路径

### Phase 1: Prompt-Native Harness

产出：

1. **harness 行为指令模板**（`CLAUDE.md` / `AGENTS.md` 注入版本）

   必须包含的规则块：
   - intake 推断规则（intent / goal / scope / acceptance 的推断逻辑）
   - clarify 追问策略（只问阻断性问题，每轮最多一个）
   - 控制信号响应规则（block_plan / block_execution / block_completion 的 L2 行为）
   - force_override 记录要求
   - interaction output 格式（我的理解 / 当前假设 / 唯一阻断问题 / 下一步动作）

2. **harness.yaml 示例配置**（至少一个项目的完整配置）

3. **三类任务模板**（bug / feature / explore，已有，需确认与 intake 的联动规则）

目标：

- 先跑通 L2，用真实任务验证 intake / clarify 流程是否有效
- 不依赖任何额外工具，只靠 agent 指令

### Phase 2: State + CLI Deterministic Core

产出：

- state 持久化（harness/state/ 目录结构）
- 确定性信号判断（CLI 工具，基于 schema 校验）
- audit_log 写入
- report 生成

目标：

- 把确定性信号从 L2 升级到 L1
- 开始积累真实审计数据

### Phase 3: Host Adapter

产出：

- 面向 Codex / Claude Code / Gemini CLI 的 adapter 实现
- 平台能力声明（capabilities）
- 针对具体宿主的门禁降级实现

目标：

- 把 Reference Adapter 变成真正可接宿主的 Host Adapter

### Phase 4: Native Upgrade

产出：

- 随平台能力提升，逐步把部分 L2 升级为 L1

目标：

- 在不改变核心协议的前提下，逼近真正 native harness

## 20. 端到端示例：Bug 修复任务完整流转

以"登录页提交后卡死"为例，展示从用户输入到任务关闭的完整状态流转。

### 20.1 用户输入

```
修下登录页提交后卡死的问题，先别动后端接口。
```

### 20.2 on_user_input 触发

**intake 推断：**

```json
{
  "intent": "bug",
  "goal": "修复登录页提交后卡死的问题",
  "scope": ["src/web/login/*"],
  "acceptance": ["登录提交后不再卡死"],
  "constraints": ["不改后端接口"],
  "assumptions": ["问题范围先限定在前端登录页"],
  "open_questions": ["完成标准是必须跳转成功，还是错误提示正确也可接受"],
  "next_action": "clarify"
}
```

**确定性信号判断：**

- `intent` ✓，`goal` ✓，`scope` ✓，`acceptance` 存在但语义不完整
- 产出信号：`ask_one_question`

**状态写入：** `current_state: needs_clarification`，state 文件落盘

### 20.3 agent 向用户输出（Interaction Output）

```
我的理解：这是前端登录页的 bug 修复，目标是解决提交后卡死，不改后端接口。
当前假设：问题可以在前端范围内定位和修复。
阻断缺口：完成标准还不够明确。
问题：必须跳转成功才算完成，还是错误提示正确也可接受？
```

### 20.4 用户回复

```
必须跳转成功才算完成。
```

### 20.5 on_user_input 触发（第二轮）

**任务归属判断：** 延续上一轮目标，映射到当前 task_id，置信度高，无需确认。

**intake 更新：**

```json
{
  "acceptance": ["登录提交后必须成功跳转"],
  "open_questions": [],
  "next_action": "plan"
}
```

**确定性信号：** 所有必填字段闭合 -> `proceed_to_plan`

**状态更新：** `draft -> planned`，confirmed_contract 生成，state 文件更新

### 20.6 plan 阶段

- `before_plan` hook：检查 confirmed_contract 完整性 -> 通过（L2）
- agent 输出执行计划（根因假设、修复路径、不做的改动、回滚方式）
- `risk_rules` 匹配：`src/web/login/*` 命中 medium 风险
- 产出信号：无额外 `require_confirmation`（medium 风险不要求强制确认，取决于项目配置）

### 20.7 execute 阶段

- `before_execute` hook：检查当前动作是否在 `src/web/login/*` 内 -> L1 工具级拦截通过
- agent 修改 `src/web/login/LoginForm.tsx`
- `after_execute` hook：state 更新为 `in_progress`，挂载 `diff_summary`

### 20.8 verify 阶段

- `before_completion` hook：检查 evidence 是否满足 §16 验证矩阵（bug 要求 command_result 或 test_result）
- agent 运行验证命令：`npm test -- login`
- 命令退出码 0，挂载 `test_result`（passed: true）
- 产出信号：`allow_completion`
- 状态：`verifying -> done`

### 20.9 report 阶段

生成结构化报告并落盘到 `harness/reports/<task_id>.json`：

```json
{
  "task_id": "bug-login-freeze-001",
  "intent": "bug",
  "conclusion": "根因：LoginForm 提交时未等待 async validate 完成即跳转，导致状态竞争卡死",
  "actual_scope": ["src/web/login/LoginForm.tsx"],
  "scope_deviation": null,
  "evidence_summary": [
    { "type": "test_result", "result": "npm test -- login", "passed": true }
  ],
  "remaining_risks": ["未覆盖 SSO 登录路径，该路径使用不同的提交逻辑"],
  "overrides_used": [],
  "next_steps": ["补充 SSO 登录路径的回归测试"],
  "completed_at": "2026-04-01T10:30:00+08:00"
}
```

### 20.10 本示例验证的设计点

| 设计点 | 是否覆盖 |
|---|---|
| 自然语言 -> Task Draft 推断 | ✓ |
| 阻断缺口识别与单问题追问 | ✓ |
| 任务归属判断与置信度判断 | ✓ |
| 确定性信号（proceed_to_plan）| ✓ |
| 工具级 L1 门禁（before_execute） | ✓ |
| 验证矩阵应用（bug 需要 test_result） | ✓ |
| report 结构化输出 | ✓ |
| state 文件全程更新 | ✓ |
| override 未使用，audit_log 为空 | ✓ |

## 21. Schema 索引

本设计涉及的所有结构化 schema：

| 对象 | 文件 | 用途 |
|---|---|---|
| Task Draft | [task-draft.schema.json](./schemas/task-draft.schema.json) | intake 阶段内部草稿 |
| Intake Result | [intake-result.schema.json](./schemas/intake-result.schema.json) | CLI 输出格式 |
| Task State | [task-state.schema.json](./schemas/task-state.schema.json) | 持久化任务状态 |
| State Index | [state-index.schema.json](./schemas/state-index.schema.json) | harness/state/index.json |
| Harness Config | [harness-config.schema.json](./schemas/harness-config.schema.json) | 项目 harness.yaml |
| Audit Log | [audit-log.schema.json](./schemas/audit-log.schema.json) | 门禁违规与 override 记录 |
| Report | [report.schema.json](./schemas/report.schema.json) | 任务完成报告 |

## 22. 与现有文档的关系

这份 v0.2 是当前最完整的主说明，统一吸收以下文档：

- [主设计稿 v0.1](./2026-03-31-project-harness-design-v0.1.md)
- [intake / interaction 规范](./2026-04-01-harness-intake-interaction-spec-v0.1.md)
- [agent-native integration 规范](./2026-04-01-harness-agent-native-integration-spec-v0.1.md)
- [agent-native feasibility analysis](./2026-04-01-harness-agent-native-feasibility-analysis-v0.1.md)

分工如下：

- v0.2 主说明：统一方向、对象和落地边界
- intake 文档：展开自然语言收敛细节
- agent-native 文档：强调目标架构与内置原则
- feasibility 文档：解释现实能力边界和降级理由

## 23. 最终判断

Harness 的核心不是"再造一个工具"，而是"给 agent 加一个不可忽略的任务收敛内核"。

v0.2 在 v0.1 的基础上，补上了 7 个落地约束，并在本版进一步补齐了以下内容：

**v0.1 -> v0.2 补充（原 7 项）：**

- 三级门禁模型
- 控制信号的来源分层
- 状态持久化与恢复
- 多任务与任务切换
- `force_override` 与审计
- Host Adapter 最小接口契约
- 按 intent 定义的最小验证矩阵

**v0.2 补充（本次 12 项）：**

- Audit Log 结构化对象定义（§6.6）
- Report Contract 定义（§6.7）
- `before_agent_reply` 明确标注为 future_placeholder（§7.1）
- `observe` 动作语义定义（§7.4）
- State 文件 Git 管理策略（§12.4）
- Schema 版本迁移策略（§12.5）
- 多任务判定 Fallback 规则（§13.4）
- Task Template 与 intake 的联动方式（§14.4）
- Phase 1 具体产出物定义（§19.1）
- 完整端到端示例（§20）
- Schema 索引（§21）
- 全部 schema 文件创建（7 个）

只要这些都守住，harness 就不会停留在"方向正确但无法落地"的阶段，而能逐步走向"方向正确且可执行"。
