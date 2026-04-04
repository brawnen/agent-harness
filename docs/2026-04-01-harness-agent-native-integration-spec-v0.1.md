# Harness Agent-Native Integration 规范 v0.1

## 1. 设计结论

Harness 的目标形态不是“一个外部工具”，而是“agent 内部的任务收敛内核”。

正确的整体关系应当是：

`User <-> Agent`

`Harness 作为 Agent Internal Kernel 挂在其决策回路中`

而不是：

`User -> Harness -> Agent`

一句话定义：

`Harness Agent-Native = 把任务收敛、边界控制、状态流转、验证门禁内置到 agent 的内部生命周期`

## 2. 要解决的问题

如果把 harness 做成外置工具，会自然滑向错误方向：

- 用户要先理解 harness，再去使用 agent
- task contract 变成用户负担，而不是 agent 内部结构
- agent 可以绕开 harness，继续凭自然语言自由发挥
- 状态和验证规则只能“建议”，不能成为 agent 的硬约束

这与 harness 的目标相冲突。

真正要实现的是：

- 用户只和 agent 进行自然语言交互
- harness 自动介入新任务的 intake / clarify / plan / verify
- harness 能阻止 agent 在条件不满足时直接执行或直接宣称完成
- task state 成为 agent 的内部工作状态，而不是用户脑内模型

## 3. 目标与非目标

### 3.1 目标

这份规范要定义：

- harness 在 agent 生命周期中的位置
- harness 能返回哪些控制信号
- agent 必须如何响应这些控制信号
- 哪些状态属于 agent 内部隐藏状态
- 用户每轮交互中应该看到什么，不应该看到什么
- adapter / plugin / CLI 在整体架构中的从属地位

### 3.2 非目标

这份规范不讨论：

- 某个平台的具体插件 API
- 某个 agent 厂商的系统 prompt 细节
- UI 组件实现方式
- 完整多 agent orchestration
- 具体语言实现

也就是说，这份文档定义的是 `native integration contract`，不是平台实现手册。

## 4. 核心原则

1. `Agent First, Tool Second`
   harness 必须先被定义成 agent 内部能力，再讨论外部载体。
2. `Single Interaction Surface`
   用户入口永远只有 agent，不应出现第二个交互入口。
3. `Harness Must Gate Behavior`
   harness 不是建议器，而是行为门禁。
4. `Internal State, External Simplicity`
   结构化状态应由 agent 内部维护，对用户保持自然语言简洁交互。
5. `Reference Adapters Are Not Architecture`
   CLI、wrapper、MCP、plugin 都只是适配方式，不得反向定义主架构。

## 5. 总体架构

### 5.1 User Interaction Layer

用户只与 agent 进行自然语言交互。

这一层的约束是：

- 用户不填写 task schema
- 用户不显式切换到 harness 工具
- 用户看到的是自然交互，而不是内部协议对象

### 5.2 Harness Core

Harness Core 是 agent-native 的真正主体，负责：

- intake
- task draft
- clarify policy
- task contract closure
- phase / state transition
- execution gate
- verification gate
- report contract

### 5.3 Host Adapter

Host Adapter 只负责把 Harness Core 接入某个 agent 宿主。

例如：

- Codex Adapter
- Claude Code Adapter
- Gemini CLI Adapter

它的职责不是重新发明协议，而是：

- 在正确生命周期节点调用 Harness Core
- 把控制信号翻译成宿主支持的动作
- 把必要状态保存在宿主可用的上下文或存储中

### 5.4 Reference Adapter

CLI、wrapper、MCP、plugin 都属于 `Reference Adapter` 或 `Host Adapter` 的实现载体。

它们有价值，但只能作为：

- 调试入口
- 原型承载
- 平台适配方式

它们不是架构中心。

## 6. 生命周期钩子

agent-native integration 必须定义稳定的生命周期钩子，而不是靠 prompt 碰运气。

第一版最小钩子建议如下：

### 6.1 `on_user_input`

触发时机：

- 用户发来新的自然语言任务
- 用户对当前任务给出新的限制、确认或修正

职责：

- 生成或更新 `Task Draft`
- 识别是否存在阻断缺口
- 生成下一步控制信号

### 6.2 `before_agent_reply`

触发时机：

- agent 准备向用户输出当前轮回复之前

职责：

- 根据 harness 当前状态决定输出类型
- 保证当前回复符合“只问一个阻断问题”或“直接进入 plan”的规则

### 6.3 `before_plan`

触发时机：

- agent 准备进入计划阶段之前

职责：

- 检查 `intent / goal / scope / acceptance` 是否已闭合
- 不满足时禁止进入 `plan`

### 6.4 `before_execute`

触发时机：

- agent 准备运行命令、改文件、调用工具之前

职责：

- 检查边界是否闭合
- 检查风险是否要求确认
- 检查当前动作是否越过 `scope` 或命中高风险门禁

### 6.5 `after_execute`

触发时机：

- 执行动作完成后

职责：

- 更新 phase / state
- 挂载 evidence
- 判断是否进入 `verify`

### 6.6 `before_completion`

触发时机：

- agent 准备宣称“已完成 / 已修复 / 已交付”之前

职责：

- 检查验证证据是否满足要求
- 不满足时禁止宣称完成

## 7. 控制信号模型

Harness Core 不应只返回“分析意见”，而应返回 agent 必须服从的控制信号。

第一版建议最小控制信号集合：

- `ask_one_question`
- `proceed_to_plan`
- `block_plan`
- `proceed_to_execute`
- `block_execution`
- `require_confirmation`
- `require_verification`
- `allow_completion`
- `block_completion`

### 7.1 信号语义

`ask_one_question`

- 当前存在阻断缺口
- agent 只能追问一个最高优先级问题

`proceed_to_plan`

- 当前合同闭合到足以制定计划

`block_plan`

- 必填字段尚未闭合，禁止进入计划

`proceed_to_execute`

- 已有计划且执行门禁通过

`block_execution`

- 边界、风险或权限条件不满足，禁止执行

`require_confirmation`

- 当前动作或范围命中高风险，需要显式确认

`require_verification`

- 当前任务已执行，但尚未满足完成门禁

`allow_completion`

- 已满足验证与结论要求，可结束任务

`block_completion`

- 不得宣称完成

## 8. 隐藏状态契约

用户不需要直接看到完整状态机，但 agent 内部必须维护它。

第一版最小隐藏状态包括：

- `task_draft`
- `confirmed_contract`
- `current_phase`
- `current_state`
- `assumptions`
- `open_questions`
- `risk_level`
- `evidence`
- `next_action`

### 8.1 设计要求

- 状态必须结构化，不允许只依赖自然语言上下文
- 状态应被视为 agent 工作内存的一部分
- 用户看到的是状态的自然语言投影，而不是状态对象本身

### 8.2 用户不可见内容

默认不直接暴露给用户：

- 完整 `Task Draft`
- 完整 `Confirmed Contract`
- 内部 phase / state 枚举值
- 控制信号原始名字
- adapter 评分或路由细节

## 9. 用户可见交互契约

虽然 harness 是内部内核，但它必须稳定塑造 agent 的外部表达。

### 9.1 每轮最小输出块

agent 在任务收敛相关轮次中，至少应隐含表达：

1. `我的理解`
   当前对任务的收敛理解
2. `当前关键假设`
   已采用但未确认的假设
3. `唯一阻断问题`
   若存在，则只问一个
4. `下一步动作`
   是继续计划、等待确认，还是进入执行

### 9.2 用户体验要求

- 用户只需要回答最少问题
- 用户不应被要求填写 schema
- 用户不应显式操作 task state
- 用户不应感知 harness 与 agent 是两套系统

## 10. 执行门禁

这是 native integration 的关键，不可退化为“建议”。

agent 在以下情况下不得直接执行：

- `intent / goal / scope / acceptance` 未闭合
- 当前存在未处理的阻断问题
- 执行动作超出当前 `scope`
- 命中高风险范围但未确认
- 当前任务处于 `needs_clarification`
- 当前 phase 尚未进入可执行阶段

这意味着：

- harness 必须有能力阻断 `execute`
- host adapter 不得绕开该门禁直接执行工具

## 11. 完成门禁

agent 在以下情况下不得宣称任务完成：

- 没有满足最小验证要求
- 必需 evidence 未挂载
- 当前仍存在未解决阻断项
- 结论与 acceptance 不匹配

所以 native integration 必须保证：

- “我觉得可以” 不能替代验证
- “代码改完了” 不等于“任务完成了”

## 12. Host Adapter 的正确地位

Host Adapter 很重要，但它不是主架构。

### 12.1 Host Adapter 负责什么

- 把宿主平台事件映射为 harness lifecycle hooks
- 把 harness 控制信号翻译成宿主可执行动作
- 维持必要的隐藏状态存储

### 12.2 Host Adapter 不负责什么

- 不重新定义 task schema
- 不重新定义 clarify policy
- 不重新定义 execution / completion gates
- 不以平台限制反向修改 Harness Core 的原则

### 12.3 设计约束

平台接入应尽量满足：

- 对用户无额外交互入口
- 对 agent 有稳定内部调用点
- 对 harness 有足够门禁执行能力

如果某平台做不到“行为门禁”，那它只能算部分适配，不算真正 native integration。

## 13. CLI、MCP、Plugin 的从属关系

这三类形态都可以存在，但其架构地位必须明确：

- `CLI`
  主要用于 reference implementation、调试与协议验证
- `MCP / tool service`
  主要用于给 agent 提供可调用能力
- `Plugin / native extension`
  主要用于接近宿主原生能力

它们都不是上位设计。

上位设计永远是：

- lifecycle hooks
- control signals
- hidden state
- execution / completion gates

## 14. 成功标准

只有满足以下条件，才能说 harness 实现了 agent-native integration：

1. 用户只和 agent 自然语言交互
2. 新任务进入时，agent 自动经过 intake
3. 有阻断缺口时，agent 只问一个最高价值问题
4. 未闭合时，agent 无法直接执行
5. 高风险时，agent 必须要求确认
6. 未验证时，agent 无法宣称完成
7. 用户不需要理解内部 schema

只要缺少第 4、5、6 中任意一项，就仍然只是“软约束工具”，而不是 native harness。

## 15. 路线图

### Phase 1: Native Core Spec

产出：

- lifecycle hooks
- control signals
- hidden state contract
- execution / completion gates

### Phase 2: Reference Host

产出：

- 参考实现，用于验证 Harness Core 可运行
- CLI 或本地适配器，仅作为承载体

### Phase 3: Host Adapters

产出：

- 面向 Codex / Claude Code / Gemini CLI 的宿主适配层

### Phase 4: Platform-Native Extensions

产出：

- 更接近官方内置体验的插件或扩展实现

注意：Phase 2 和 Phase 3 不得反向定义 Phase 1。

## 16. 与现有设计文档的关系

这份文档是现有设计的上位集成规范：

- [主设计稿](./2026-03-31-project-harness-design-v0.1.md)
  定义对象、状态和项目配置
- [intake / interaction 规范](./2026-04-01-harness-intake-interaction-spec-v0.1.md)
  定义自然语言如何收敛成 task draft
- [intake CLI 规范](./2026-04-01-harness-intake-cli-spec-v0.1.md)
  只是 reference adapter 规范，不是主架构

换句话说：

- 主设计稿回答“harness 有哪些对象”
- intake 规范回答“harness 如何收敛任务”
- 本文回答“harness 如何原生内置到 agent”

## 17. 最终判断

Harness 不应该被实现成“agent 外部可调用的小工具”，而应该被实现成“agent 内部不可绕开的任务收敛内核”。

只要守住这几点：

- agent 是唯一用户入口
- harness 具备行为门禁
- 内部维护结构化状态
- 外部保持自然语言简洁交互
- 任何 adapter 都不能绑架主架构

这套设计才不会在实现过程中退化成折中方案。
