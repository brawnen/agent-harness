# Harness Kernel Rules

本项目使用 Harness 协议约束 agent 行为。以下规则为强制执行项。

## 1. Current Work-Unit Convergence

每次收到新输入时，agent 必须先收敛当前 `work unit`，至少明确以下字段：

- `intent`
- `goal`
- `scope`
- `acceptance`
- `constraints`
- `assumptions`

在字段未闭合前，不得直接进入写入或执行阶段。

这里的 `work unit` 指 agent 当前准备推进的那一段实际工作，不要求先在 prompt 层定义正式 `task`。

`next_action` 判断原则：

- 字段已闭合且无阻断问题 -> `plan` 或 `execute`
- 可先通过阅读代码、状态或上下文收敛边界 -> `observe`
- 输入只是当前任务内的简短回复或步骤选择 -> `observe`
- 只有存在真实阻断缺口时才 `clarify`

只有在需要持久化、恢复、审计，或进入 `verify / report / delivery` 时，runtime 才需要把该 `work unit` 落成真正的 `task state`。

## 2. Clarify

只在以下情况追问用户，且每次只问一个最高价值问题：

1. `scope` 不清，可能越界
2. `acceptance` 无法判断
3. 存在高成本路径分叉，需要用户决策
4. 命中高风险区域，需确认
5. 任务依赖外部资源或权限

可以通过阅读代码自行确认的技术细节，不应追问用户。

## 3. Execute Gate

以下情况禁止直接执行工具调用或修改文件：

1. `intent / goal / scope / acceptance` 未闭合
2. 当前任务处于 `needs_clarification`
3. 动作明显超出已确认的 `scope`
4. 命中高风险范围但未获确认
5. 存在未处理的阻断问题

若命中门禁：

- 停止当前动作
- 说明阻断原因
- 只提出当前最高价值的缺口

## 4. Completion Gate

以下情况禁止宣称任务完成：

- 必需 evidence 未产生
- `acceptance` 与结果不匹配
- 仍存在未关闭的阻断问题

最低验证要求：

| intent | 最低要求 |
|---|---|
| `bug` | 至少一条命令或测试证明问题不再复现 |
| `feature` | 至少一条命令或验证动作证明新能力可运行 |
| `refactor` | 至少一条测试证明行为未破坏 |
| `explore` | 必须给出结论、依据、风险与下一步建议 |
| `prototype` | 可无强制验证，但必须明确标注未验证范围 |

## 5. Observe

当 `next_action` 为 `observe` 时：

- 只允许只读动作
- 禁止修改文件和其他有副作用的动作
- observe 结束后必须重新判断 `next_action`

## 6. Override

用户可以显式要求跳过部分门禁。

可跳过：

- `clarify`
- 非强制验证要求
- 高风险确认提示

不可跳过：

- `protected_paths` 写入限制
- 文件系统或平台硬权限限制

使用 override 时，必须明确标注被跳过的门禁和当前风险。

## 7. Multi-task

- 新输入默认先判断是否属于当前活跃任务
- 明显新任务应新建并挂起旧任务
- 若只是对上轮问题的回答、步骤选择或简短确认，默认视为当前任务续接
- 无法确定时，先澄清任务归属
- 切换任务前必须保存当前任务状态
