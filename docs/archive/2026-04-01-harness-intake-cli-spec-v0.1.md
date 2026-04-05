# Harness Intake CLI 规范 v0.1

## 1. 设计结论

最小 `intake CLI` 不负责执行任务，只负责把自然语言需求编译成结构化结果。

第一版 CLI 的职责只有三件事：

- 接收自然语言输入
- 输出标准化 `Task Draft`
- 告诉调用方当前是 `planned` 还是 `needs_clarification`

因此第一版命令应保持极小：

`harness task intake "<natural language>"`

## 2. 输入契约

### 2.1 必需输入

- 用户自然语言需求

### 2.2 可选输入

- `--project <path>`
  指定项目配置文件，默认读取当前目录 `harness.yaml`
- `--format json|yaml`
  第一版默认 `json`
- `--context-ref <value>`
  附加上下文引用，可重复传入

第一版不支持：

- 直接传完整 task contract
- 批量 intake 多个任务
- 自动执行仓库修改

## 3. 输出契约

CLI 标准输出必须符合：

- [task-draft.schema.json](/Users/lijianfeng/code/pp/harness/harness/schemas/task-draft.schema.json)
- [intake-result.schema.json](/Users/lijianfeng/code/pp/harness/harness/schemas/intake-result.schema.json)

最小输出对象：

```json
{
  "schema_version": "0.1",
  "command": "intake",
  "status": "planned",
  "task_draft": {},
  "interaction": {}
}
```

## 4. 输出字段说明

### 4.1 `status`

第一版只允许三种结果：

- `planned`
  intake 已经足够支持进入 `plan`
- `needs_clarification`
  还存在阻断性缺口
- `failed`
  输入无法解析，或与项目配置发生硬冲突

### 4.2 `task_draft`

`task_draft` 是 agent 的内部结构化结果，要求：

- 必须包含推断后的 `intent / goal / scope / acceptance`
- 必须保留 `source_input`
- 必须给出 `assumptions` 与 `open_questions`
- 必须给出 `next_action`

### 4.3 `interaction`

`interaction` 是对用户或上层 agent 暴露的最小交互块，要求与 intake 规范一致：

- `summary`
  当前理解的任务摘要
- `assumptions`
  当前采用但未确认的假设
- `blocking_gap`
  当前最重要的阻断缺口，无则为 `null`
- `question`
  需要追问给用户的单个问题，无则为 `null`
- `next_action`
  上层应进入 `clarify`、`plan`、`observe` 或 `fail`

## 5. 退出语义

第一版建议采用以下退出语义：

- `status=planned`
  CLI 成功，且上层可以直接进入 `plan`
- `status=needs_clarification`
  CLI 成功，但上层必须先处理 `question`
- `status=failed`
  CLI 失败或无法继续收敛

无论状态如何，只要成功产出结构化对象，进程退出码都建议为 `0`。

只有在以下情况下才返回非 `0`：

- 配置文件读取失败
- 输出序列化失败
- 输入参数非法

## 6. 标准行为约束

第一版 CLI 必须遵守：

- 不把内部 schema 当成表单要求用户填写
- 能推断就不追问
- 每次最多产出一个 `question`
- `blocking_gap` 为 `null` 时，不应继续要求澄清
- `status=planned` 时，`interaction.question` 必须为 `null`

## 7. 示例

### 7.1 直接进入计划

示例文件：
[intake-plan.example.json](/Users/lijianfeng/code/pp/harness/harness/examples/intake-plan.example.json)

适用场景：

- 需求边界清楚
- 验收标准足够明确
- 不存在高风险冲突

### 7.2 进入澄清

示例文件：
[intake-clarify.example.json](/Users/lijianfeng/code/pp/harness/harness/examples/intake-clarify.example.json)

适用场景：

- 完成标准不够清楚
- 推断范围可能越界
- 需要一个关键追问才能继续

## 8. 与现有设计的关系

这份 CLI 规范依赖：

- [主设计稿](./2026-03-31-project-harness-design-v0.1.md)
- [intake / interaction 规范](./2026-04-01-harness-intake-interaction-spec-v0.1.md)

关系分工：

- 主设计稿定义对象、状态和配置边界
- intake 规范定义自然语言如何收敛成 `Task Draft`
- CLI 规范定义这个收敛结果如何稳定输出给上层

## 9. MVP 范围

第一版 CLI 只需要支持：

- 单条自然语言输入
- 单个 `Task Draft` 输出
- 单个阻断问题输出
- JSON 格式标准输出

第一版不做：

- interactive shell
- 多轮会话管理
- 任务持久化
- 自动 plan / execute

## 10. 最终判断

如果没有稳定的 CLI 输出格式，intake 规范只能停留在文档层。

只有把 `Task Draft` 和 `intake result` 定成机器可读契约，后续无论是 agent 直接调用、脚本接入，还是本地 runner 落地，才不会再次退回自然语言漂移。
