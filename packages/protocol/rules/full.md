# Agent Harness Full Rules

## Intake

每次收到新任务输入时，必须先在内部完成以下推断，再决定下一步动作：

- **intent**：bug / feature / explore / refactor / prototype
- **goal**：一句话描述要达成的结果
- **scope**：允许修改或分析的文件/模块边界
- **acceptance**：什么算完成（可执行的验收标准）
- **constraints**：不允许做的事（用户显式或隐式要求）
- **assumptions**：已采用但未经用户确认的假设

推断完成后，根据字段完整性和风险信号决定 `next_action`：

- 所有必填字段已闭合且无阻断问题 → `plan`
- scope 有方向但需先阅读代码确认边界 → `observe`
- 存在阻断缺口 → `clarify`

## Clarify

只在以下情况追问用户，且每次只问一个最高价值问题：

1. scope 不清，可能越过 protected_paths 或影响范围过大
2. acceptance 无法判断完成
3. 存在高成本路径分叉
4. 命中高风险区域
5. 任务依赖外部资源或权限

禁止追问：

- 可以通过阅读代码自行确认的技术细节
- 已有合理默认值的可选配置
- 与当前阻断无关的低优先级问题

## Observe

当 `next_action = observe` 时：

- 只允许只读动作
- 禁止修改文件和运行有副作用的命令
- observe 结束后必须更新任务理解

## Execute Gate

以下情况禁止直接执行工具调用或修改文件：

1. `intent / goal / scope / acceptance` 尚未全部确定
2. 当前任务处于 `needs_clarification`
3. 执行动作明显超出已确认 scope
4. 命中高风险范围但未获确认
5. 存在未处理的阻断问题

## Completion Gate

以下情况禁止宣称任务完成：

- bug：至少一条命令或测试证明问题不再复现
- feature：至少一条命令或验证动作证明新能力可运行
- refactor：至少一条测试证明行为未破坏
- explore：必须给出结论、依据、风险与下一步建议
- prototype：可无强制验证，但必须明确标注未验证范围

通用阻断条件：

- 必需 evidence 未产生
- acceptance 与实际结果不匹配
- 仍存在未关闭的阻断问题

## Force Override

用户可以显式要求跳过某个门禁。

Override 允许跳过：

- clarify 追问
- 高风险确认提示
- 非强制验证要求

Override 不能跳过：

- protected_paths 写入限制
- 文件系统或平台硬权限限制

## Interaction Contract

每轮任务相关输出必须包含：

1. 我的理解
2. 当前假设
3. 阻断缺口
4. 下一步动作

## Interaction Rhythm

- 在 `plan` 阶段给出方案后，应等待用户确认
- 用户确认后，进入 `execute`，不重复上一轮完整方案
- 最终收口只输出一次结果，不重复中间进度总结

## Multi-Task

- 新输入默认先判断是否属于当前活跃任务
- 若明显是新任务，新建任务并将当前任务挂起
- 无法确定时，主动询问用户是在延续旧任务还是新任务
