# Harness Intake / Interaction 规范 v0.1

## 1. 设计结论

Harness 不应要求用户先填写 `Task Contract`，而应允许用户继续使用自然语言表达需求。

第一版的正确交互模型是：

`自然语言输入 -> Intake Compiler -> Task Draft -> Clarify Policy -> Confirmed Contract`

其中：

- 用户只负责表达目标、约束和偏好
- agent 负责把自然语言收敛成结构化任务
- 只有在无法安全执行时，agent 才向用户追问最小必要信息

一句话定义：

`Intake Layer = 自然语言编译器 + 缺口识别器 + 最小追问策略`

## 2. 要解决的问题

如果只有 `Task Contract`，但没有 intake 规则，实际交互会退化成两种低效模式：

1. 用户自己在脑中维护 schema，再翻译给 agent
2. agent 机械要求用户填写表单，交互成本过高

这都违背 harness 的目标。真正要解决的是：

- 用户继续自然说话
- agent 自动做第一轮结构化推断
- agent 只在必要时追问
- agent 内部维护 task，而不是把 schema 暴露给用户

## 3. 目标与非目标

### 3.1 目标

第一版 intake 规范要做到：

- 从自然语言自动推断 `Task Draft`
- 结合项目配置补默认值
- 识别哪些缺口会阻断执行
- 规定何时可以直接进入 `plan`
- 规定何时必须进入 `clarify`
- 统一 intake / clarify 阶段的交互输出格式

### 3.2 非目标

第一版不做：

- 自然语言理解的模型训练
- 复杂对话记忆系统
- 多轮会话自动摘要引擎
- 高级优先级调度
- 自动执行代码修改

Intake 只负责把任务收敛到“可计划”，不负责把任务做完。

## 4. 核心原则

1. `Natural Language First`
   用户永远可以直接说自然语言，不要求先填结构化表单。
2. `Infer Before Asking`
   能从输入、仓库和项目配置推断的，不先问用户。
3. `Ask Only Blocking Questions`
   只追问会阻断执行或显著提高风险的问题。
4. `One Question At A Time`
   每轮最多追问一个最高价值问题。
5. `Internal Structure, External Simplicity`
   schema 属于 agent 内部，不应直接变成用户负担。

## 5. Intake 在总体流程中的位置

它与主设计稿中的 Phase Model 对应关系如下：

- `intake`
  负责解析用户输入，生成 `Task Draft`
- `clarify`
  负责处理阻断性缺口，把草稿收敛成 `Confirmed Contract`
- `plan`
  只接收“必填字段已闭合”的合同

因此：

- `intake` 的输出不是最终任务，而是 `Task Draft`
- `clarify` 的目标不是泛泛讨论，而是关闭阻断缺口
- 只有当 `intent / goal / scope / acceptance` 可执行时，任务才能进入 `planned`

## 6. Task Draft 模型

`Task Draft` 是 intake 阶段的内部对象，不等于最终 `Task Contract`。

建议最小字段：

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

字段语义：

- `source_input`：用户原始自然语言输入
- `intent`：当前推断的任务类型
- `goal`：当前推断的直接目标
- `scope`：当前推断的修改或分析边界
- `acceptance`：当前推断的完成标准
- `constraints`：用户显式提出或系统推断出的限制
- `mode`：当前推断的工作模式
- `assumptions`：agent 为推进任务做出的暂定假设
- `open_questions`：当前阻断执行的最小问题集
- `risk_signals`：高风险或不确定信号
- `context_refs`：关联到的文件、日志、报错、文档
- `next_action`：下一步是追问、计划还是执行观察动作

## 7. 字段推断规则

### 7.1 `intent` 推断

第一版按语义优先匹配：

- “修复 / 排查 / 报错 / 不生效 / 卡死” -> `bug`
- “新增 / 支持 / 实现 / 增加能力” -> `feature`
- “调研 / 分析 / 阅读代码 / 解释 / 看看” -> `explore`
- “试一下 / 快速验证 / PoC / 草稿” -> `prototype`

若同时命中多个意图，优先取用户显式主语义，否则进入 `clarify`。

### 7.2 `mode` 推断

第一版按以下顺序决定：

`用户显式说明 > 任务语义推断 > project default_mode`

示例：

- “先调研一下” -> `explore`
- “快速验证” -> `poc`
- 未说明时 -> 取 `harness.yaml` 中的 `default_mode`

### 7.3 `goal` 推断

优先从用户描述中提取“要达成的结果”，而不是“要做的动作”。

例如：

- “看看登录页为什么卡死” -> `goal=定位登录页卡死原因`
- “给发布页加定时发布” -> `goal=支持发布页的定时发布能力`

若只能提取到操作动作，允许先形成弱目标，再在 `clarify` 中收紧。

### 7.4 `scope` 推断

第一版可按三层来源推断：

1. 用户显式指定的目录、模块、系统边界
2. 仓库结构和上下文引用
3. 项目 `allowed_paths` 和既有任务模板

约束：

- 推断出的 `scope` 不得越过 `protected_paths`
- 若范围可能跨前后端、跨服务或跨仓库，默认进入 `clarify`
- 若只能推断出“领域范围”而不能落到模块范围，允许先进入 `explore`，不能直接进入 `execute`

### 7.5 `acceptance` 推断

第一版允许根据任务类型给出草拟完成标准：

- `bug`
  - 问题不再复现
  - 不引入已知回归
- `feature`
  - 新能力可被使用
  - 不破坏现有兼容性
- `explore`
  - 给出结论、原因、风险和下一步建议

如果验收标准影响技术路径选择，必须进入 `clarify`。

### 7.6 `constraints` 推断

来源优先级：

`用户显式限制 > 项目 protected_paths / risk_rules > 通用默认约束`

通用默认约束包括：

- 不扩大改动范围
- 不顺手重构无关模块
- 未确认前不改高风险路径

## 8. 缺口识别规则

Intake 不是检查“字段是否漂亮”，而是识别“是否还能安全推进”。

### 8.1 可直接推进的情况

满足以下条件，可直接进入 `plan`：

- 已能稳定推断 `intent`
- `goal` 足够具体
- `scope` 已落到可操作边界
- `acceptance` 足以判断是否完成
- 没有命中高风险或冲突约束

### 8.2 必须进入 `clarify` 的情况

出现以下任一情况，必须追问或显式声明缺口：

- `scope` 不清，可能越过受保护路径
- `acceptance` 不清，无法判断完成
- 同时存在两个以上高成本技术路径
- 用户要求与项目配置冲突
- 风险等级被推断为 `high`
- 任务依赖外部资源、权限或环境信息

### 8.3 可保留为假设的情况

以下内容可先写入 `assumptions`，不必立即追问：

- 任务标题
- 次要背景信息
- 非关键上下文引用
- 对最终结论不构成阻断的次要细节

## 9. Clarify Policy

### 9.1 追问目标

`clarify` 阶段只做一件事：关闭阻断计划和执行的最小缺口。

它不是：

- 让用户补完全部字段
- 做长篇 brainstorming
- 用问题把用户拖进 schema

### 9.2 追问排序

若存在多个缺口，按以下优先级选择一个问题：

1. 会导致越界修改的问题
2. 会导致验收标准错误的问题
3. 会导致技术路径分叉过大的问题
4. 会导致验证方式不成立的问题
5. 其他非阻断问题

### 9.3 追问形式

每轮只问一个问题，问题必须满足：

- 能被用户快速回答
- 与当前任务直接相关
- 不要求用户理解内部 schema
- 回答后能显著减少不确定性

错误示例：

- “请补充 intent、mode、scope、acceptance”

正确示例：

- “我的理解是这是前端登录页的 bug 修复。还缺一个关键信息：完成标准是必须跳转成功，还是正确提示错误也算可接受？”

## 10. Interaction Output Protocol

在 `intake` 和 `clarify` 阶段，agent 每轮都应按固定结构输出，避免交互漂移。

### 10.1 标准输出块

每轮至少包含：

1. `我的理解`
   当前推断出的任务摘要
2. `当前假设`
   agent 已采用但未确认的假设
3. `阻断缺口`
   当前最关键的一个缺口；若无则明确写“无”
4. `下一步动作`
   会进入 `clarify`、`plan` 还是直接执行观察动作

### 10.2 行为约束

- 若 `阻断缺口=无`，应直接进入下一阶段，而不是继续追问
- 若缺口存在，只允许问一个最高优先级问题
- 不应把完整内部结构原样抛给用户
- 可以在内部维护完整 draft，但对外应保持简洁

## 11. Intake 到 Confirmed Contract 的流转

### 11.1 状态流转

- 初始输入 -> 生成 `Task Draft`
- 若存在阻断缺口 -> `needs_clarification`
- 若无阻断缺口 -> `planned`

### 11.2 合同闭合条件

只有当以下条件同时满足，才允许把 `Task Draft` 提升为 `Confirmed Contract`：

- `intent` 已确定
- `goal` 已具体化
- `scope` 已落到可操作边界
- `acceptance` 已能判断完成
- 风险未超过当前阶段允许范围，或已被明确确认

## 12. 示例

### 12.1 Bug 示例

用户输入：

> 修下登录页提交后卡死的问题，先别动后端接口。

内部 draft：

```yaml
intent: bug
goal: 修复登录页提交后卡死的问题
scope:
  - src/web/login/*
acceptance:
  - 登录提交后不再卡死
constraints:
  - 不改后端接口
assumptions:
  - 问题范围先限定在前端登录页
open_questions:
  - 完成标准是否要求必须成功跳转
next_action: clarify
```

对外输出：

- 我的理解：这是一个前端登录页 bug 修复任务，目标是解决提交后卡死，当前边界先限定在登录页前端，不改后端接口。
- 当前假设：问题可以先在前端范围内定位和修复。
- 阻断缺口：完成标准还不够明确，必须成功跳转才算完成，还是错误提示正确也可接受？
- 下一步动作：等待这个问题确认后进入计划。

### 12.2 Explore 示例

用户输入：

> 帮我看看这个仓库现在的发布链路是不是太耦合了，先别改代码。

内部 draft：

```yaml
intent: explore
mode: explore
goal: 评估当前发布链路的耦合程度
scope:
  - repository architecture
acceptance:
  - 给出是否耦合过高的结论
  - 说明原因、风险和后续建议
constraints:
  - 不改代码
open_questions: []
next_action: plan
```

这里无需追问，因为目标、范围和约束都已经足以支持调研。

## 13. 与现有设计稿的关系

这份规范是对主设计稿中以下部分的补完：

- `Task Contract`
  解释字段如何从自然语言中产生
- `Phase Model`
  细化 `intake` 与 `clarify` 的职责边界
- `State Model`
  说明什么情况下从 `draft` 进入 `needs_clarification` 或 `planned`
- `Project Config`
  说明 `default_mode`、`allowed_paths`、`protected_paths`、`risk_rules` 如何参与推断

因此，主设计稿负责“对象与状态”，这份 intake 规范负责“交互与编译”。

## 14. MVP 范围

第一版只要求实现这些能力：

- 自然语言到 `Task Draft` 的基础推断
- 最小缺口识别
- 单问题追问策略
- 标准化交互输出块
- 与项目配置联动的默认值注入

第一版不做：

- 多问题批量问答
- 历史会话自动抽象
- 高级置信度学习
- 基于模型反馈的动态策略优化

## 15. 最终判断

Harness 的交互层不应该要求用户学会 schema，而应该让 agent 学会把用户自然语言编译成 schema。

只要守住这几点：

- 先推断，再追问
- 只问阻断性问题
- 每轮只问一个问题
- 内部结构化，对外保持简洁

这套 intake / interaction 设计就能真正支撑 `harness engineering` 在日常开发流程中落地。
