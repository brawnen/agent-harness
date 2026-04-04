# Harness 任务收敛规则

本项目使用 Harness 协议约束 agent 行为。以下规则为强制执行项。

## Harness Intake 规则

每次收到新任务输入时，必须先在内部完成以下推断，再决定下一步动作：

- **intent**：bug / feature / explore / refactor / prototype
- **goal**：一句话描述要达成的结果
- **scope**：允许修改或分析的文件/模块边界
- **acceptance**：什么算完成（可执行的验收标准）
- **constraints**：不允许做的事（用户显式或隐式要求）
- **assumptions**：已采用但未经用户确认的假设

所有字段均从自然语言推断，不要求用户填写结构化表单。

推断完成后，根据字段完整性和风险信号决定 `next_action`：
- 所有必填字段已闭合且无阻断问题 → `plan`
- scope 有方向但需先阅读代码确认边界 → `observe`（只读）
- 存在阻断缺口 → `clarify`

## Harness Clarify 规则

只在以下情况追问用户，且每次只问一个最高价值问题：

1. scope 不清，可能越过 protected_paths 或影响范围过大
2. acceptance 无法判断完成（模糊、矛盾或缺失）
3. 存在高成本路径分叉，需用户决策
4. 命中高风险区域（risk_level: high）
5. 任务依赖外部资源或权限，需确认可用性

禁止追问的情况：
- 可以通过阅读代码自行确认的技术细节
- 已有合理默认值的可选配置
- 与当前阻断无关的低优先级问题

## Harness 执行门禁（L2）

以下情况**禁止**直接执行工具调用或修改文件：

1. intent / goal / scope / acceptance 尚未全部确定
2. 当前任务处于 `needs_clarification` 状态
3. 执行动作明显超出已确认的 scope
4. 命中高风险范围但未获得用户确认
5. 存在未处理的阻断问题（open_questions 非空且为阻断性）

违反执行门禁时的处理：
- 停止当前动作
- 说明被阻断的原因
- 给出需要用户确认或补充的内容

> **注意**：当前项目已为 Codex 接入 repo-local hooks（`.codex/hooks.json`），可自动执行最小 intake 与 active task 恢复；Claude Code / Gemini CLI 仍主要依赖本规则（L2）。即便在 Codex 下，执行门禁也不能只依赖 hook，规则未满足时仍不得写入。

## Harness 完成门禁（L2）

以下情况**禁止**宣称任务完成：

| intent | 最低验证要求 |
|---|---|
| bug | 至少一条命令或测试证明问题不再复现 |
| feature | 至少一条命令或验证动作证明新能力可运行 |
| refactor | 至少一条测试证明行为未破坏 |
| explore | 必须给出结论、依据、风险与下一步建议 |
| prototype | 可无强制验证，但必须明确标注未验证范围 |

通用阻断条件：
- 必需 evidence 未产生
- acceptance 与实际结果不匹配
- 仍存在未关闭的阻断问题

## Harness Observe 规则

当 `next_action` 为 `observe` 时：

- 只允许只读动作：读文件、搜索代码、阅读日志
- 禁止修改文件、运行有副作用的命令
- observe 结束后必须更新内部任务理解，重新判断 next_action
- observe 的发现必须作为 reasoning_note 记录

## Harness Force Override 规则

用户可以显式要求跳过某个门禁（如"别问了直接做"、"跳过验证"）。

Override 允许跳过：
- clarify 追问
- 高风险确认提示
- 非强制验证要求

Override 不能跳过：
- protected_paths 写入限制
- 文件系统或平台硬权限限制

使用 override 时必须：
- 在输出中明确标注"已跳过 XXX 门禁"
- 记录被跳过的门禁、用户确认语句、当前风险等级

## Harness 交互输出格式

每轮任务相关输出必须包含以下信息（可用自然语言表达，不要求固定模板）：

1. **我的理解**：当前对任务的收敛理解（intent + goal + scope 的摘要）
2. **当前假设**：已采用但未确认的假设列表
3. **阻断缺口**：若存在，只列出一个最高优先级的；若无，明确说"无"
4. **下一步动作**：clarify / observe / plan / execute / verify 中的一个

## Harness 多任务规则

- 新输入默认先判断是否属于当前活跃任务
- 若明显是新任务，新建任务并将当前任务挂起
- 无法确定时，主动询问用户："你说的是刚才 XXX 的任务，还是一个新问题？"
- 切换任务前必须先保存当前任务状态

## Harness State 持久化

本项目当前使用 Node 版 harness CLI（`node packages/cli/bin/agent-harness.js`）。

### Codex 自动模式

当前仓库已提供 repo-local `.codex/hooks.json`，并通过项目级 `.codex/config.toml` 默认开启 `codex_hooks`。在 trusted project 场景下：

- `SessionStart` 会尝试恢复 active task 摘要
- `UserPromptSubmit` 会自动判断是续写当前任务、创建新任务，还是要求先澄清
- 明显新任务会自动挂起旧任务

建议在当前仓库中使用：

- `codex`
- `codex exec ...`

若项目未被 Codex 视为 trusted project，仍可显式使用：

- `codex --enable codex_hooks`
- `codex exec --enable codex_hooks ...`

### 手动 fallback

当 hook 未启用、自动 intake 失败，或需要人工修正任务归属时，手动调用现有命令：

- 直接从自然语言创建任务：`node packages/cli/bin/agent-harness.js task intake "任务描述"`
- 挂起当前 active task：`node packages/cli/bin/agent-harness.js task suspend-active --reason "原因"`
- 任务初始化：准备 task draft JSON 后执行 `node packages/cli/bin/agent-harness.js state init --draft-file <path>`
- 查看当前活跃任务：`node packages/cli/bin/agent-harness.js state active`
- 查看指定任务状态：`node packages/cli/bin/agent-harness.js state get --task-id <id>`
- 任务完成前：`node packages/cli/bin/agent-harness.js verify --task-id <id>`
- 任务完成后：`node packages/cli/bin/agent-harness.js report --task-id <id> --conclusion "结论"`

状态文件位置：
- 任务状态：`harness/state/tasks/<task_id>.json`
- 任务索引：`harness/state/index.json`
- 审计日志：`harness/audit/<task_id>.jsonl`
- 完成报告：`harness/reports/<task_id>.json`

## 项目配置

- 配置文件：`harness.yaml`
- protected_paths：`.idea/**`
- 任务模板：`harness/tasks/` 下 bug.md / feature.md / explore.md
- 风险规则见 harness.yaml 中 risk_rules 部分
