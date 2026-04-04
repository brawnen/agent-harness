# Codex 自动 Intake 设计稿 v0.1

## 1. 状态

Proposed

## 2. 目标

为 `Codex` 宿主定义一条可落地的自动 intake 链路，使用户在终端中直接输入自然语言任务时：

1. 宿主能在 prompt 发给模型前触发 intake
2. Harness 能自动识别“延续当前任务”还是“新任务开始”
3. 新任务可自动写入 `harness/state/`
4. 歧义任务不会被静默错误归类
5. Codex 可以收到当前任务摘要作为额外上下文

本设计回答的是“Codex 如何自动触发 Harness intake”，不是完整宿主集成的全部实现。

## 3. 非目标

本稿明确不做：

- 不直接实现完整 hook 脚本
- 不要求一次性补齐 `before_completion` 的宿主级硬门禁
- 不定义 Claude Code / Gemini CLI 的自动 intake 细节
- 不把 `task intake` 手动命令作为主用户路径

## 4. 设计结论

`Codex` 的自动 intake 应以 `UserPromptSubmit` 为主入口，以 `SessionStart` 为恢复入口。

职责划分如下：

- `UserPromptSubmit`
  - 判断当前 prompt 是续写当前任务还是新任务
  - 在必要时自动创建新 task state
  - 在歧义情况下向 Codex 注入 clarify 上下文，必要时阻断本轮 prompt
- `SessionStart`
  - 在 `startup` / `resume` 时恢复 active task
  - 将 task 摘要、当前 phase/state、未关闭问题注入为额外开发者上下文

手动 `task intake` 只作为 fallback，不是主路径。

## 5. 依据

截至 2026-04-03，OpenAI 官方 Codex hooks 文档已经给出以下能力：

1. `UserPromptSubmit` hook 可在用户 prompt 发送前触发，并将 `prompt`、`turn_id` 等信息通过 `stdin` 传给本地命令。
2. `UserPromptSubmit` hook 可通过 `additionalContext` 向当前轮追加开发者上下文。
3. `UserPromptSubmit` hook 可通过 `decision: "block"` 或退出码 `2` 阻断本轮 prompt。
4. `SessionStart` hook 可在 `startup` / `resume` 时触发，并通过 `additionalContext` 恢复会话上下文。
5. 当前 `PreToolUse` / `PostToolUse` 在 Codex 运行时只对 `Bash` 有效，不能承担语义级 intake 主逻辑。

官方来源：

- Codex Hooks
  https://developers.openai.com/codex/hooks
- Codex CLI
  https://developers.openai.com/codex/cli
- Introducing Codex
  https://openai.com/index/introducing-codex/

## 6. 宿主事件映射

### 6.1 `UserPromptSubmit` -> `on_user_input`

这是自动 intake 的主触发点。

输入：

- `session_id`
- `turn_id`
- `cwd`
- `prompt`
- `hook_event_name`

输出：

- 正常继续：返回 `additionalContext`
- 需要澄清：返回 `additionalContext`
- 需要硬阻断：返回 `decision: "block"`

### 6.2 `SessionStart` -> `restore_state`

这是会话恢复入口。

输入：

- `session_id`
- `cwd`
- `source=startup|resume`

输出：

- 若存在 active task：返回 `additionalContext`
- 若不存在 active task：静默成功

## 7. 自动 Intake 总体流程

```text
用户输入 prompt
  -> Codex UserPromptSubmit hook
  -> repo-local intake bridge 脚本
  -> 读取 harness/state/index.json
  -> 判断:
       A. 属于当前任务续写
       B. 明显是新任务
       C. 无法确定
  -> A: 仅注入当前 task context
  -> B: 挂起旧任务 -> 创建新 task -> 注入新 task context
  -> C: 注入 clarify context，必要时阻断 prompt
  -> Codex 收到额外上下文后继续本轮
```

## 8. 新任务判定规则

### 8.1 明显续写当前任务

满足以下任一条件，可视为续写：

- prompt 明确引用当前 task 的目标、文件或结论
- 当前 active task 仍为 `planned / in_progress / verifying`，且 prompt 语义仍在同一 scope 内
- prompt 属于前一轮执行的直接 follow-up，例如“继续”“按刚才方案实现”“补测试”“修掉那个 lint”

处理：

- 不新建 task
- 将当前 task 摘要注入 `additionalContext`

### 8.2 明显是新任务

满足以下任一条件，可视为新任务：

- prompt 主题与当前 active task 的 `goal/scope` 明显不连续
- prompt 显式表达“另一个问题”“新任务”“顺便再做 X”
- 当前 active task 已是 `done / failed / suspended`，且 prompt 有新的明确目标

处理：

1. 若当前 active task 未完成，先将其状态切为 `suspended`
2. 为新 prompt 生成 `task_draft`
3. 持久化为新的 active task
4. 将新 task 摘要注入 `additionalContext`

### 8.3 无法确定

以下情况归为歧义：

- prompt 只有“看一下这个”“有个问题”这类低信息短句
- prompt 同时包含旧任务延续和新方向切换信号
- scope 可能跨越 protected paths 或高风险区域

处理原则：

- 默认不静默创建新任务
- 优先通过 `additionalContext` 提醒 Codex 先 clarify
- 若风险高，直接 block 当前 prompt，并要求先澄清任务归属

## 9. 自动生成的最小 Task Draft

自动 intake 不要求一次性补齐完整合同，但必须生成最小可追踪草稿：

```json
{
  "schema_version": "0.3",
  "source_input": "<原始 prompt>",
  "intent": "bug|feature|explore|refactor|prototype|unknown",
  "goal": "<一句话目标>",
  "scope": ["<推断范围或占位范围>"],
  "acceptance": ["<推断完成标准或 clarify 占位>"],
  "constraints": [],
  "assumptions": [],
  "open_questions": [],
  "risk_signals": [],
  "context_refs": [],
  "next_action": "plan|observe|clarify",
  "derived": {
    "risk_level": "low|medium|high",
    "state": "planned|needs_clarification"
  }
}
```

最小原则：

- 字段能推断就填
- 不能推断就进入 `needs_clarification`
- 不允许为了“自动化好看”编造虚假的 scope/acceptance

## 10. State 写入策略

### 10.1 自动新建任务

自动 intake 成功后，bridge 脚本应等价执行以下动作：

1. 读取当前 active task
2. 若旧任务未完成且确为切题，写回 `suspended`
3. 调用 Node CLI 的底层能力创建新 state
4. 更新 `harness/state/index.json` 的 `active_task_id`

### 10.2 自动恢复任务

`SessionStart` 时：

- 若存在 active task，读取：
  - `task_id`
  - `goal`
  - `current_phase`
  - `current_state`
  - 首个阻断问题
- 作为 `additionalContext` 注入 Codex

### 10.3 失败降级

若 bridge 脚本失败：

- 不应破坏 Codex 正常工作
- 默认 fail open，允许本轮继续
- 同时返回 `systemMessage` 提示自动 intake 失效
- 必要时记录 `audit_log`

## 11. Codex Hook 输出策略

### 11.1 正常继续

返回：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "当前 active task: ... 下一步动作: ..."
  }
}
```

用途：

- 给 Codex 注入 task 上下文
- 让 Codex 继续正常响应

### 11.2 歧义但不阻断

返回：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "当前输入无法确定是在延续旧任务还是新任务。先向用户澄清任务归属，再继续执行。"
  }
}
```

用途：

- 保留交互流畅度
- 让 Codex 在本轮优先 clarify

### 11.3 高风险阻断

返回：

```json
{
  "decision": "block",
  "reason": "当前输入涉及高风险或任务归属不明，先澄清后再继续。"
}
```

用途：

- 避免高风险 prompt 在未建立 task contract 前直接进入模型主循环

## 12. 建议的仓库内落地形态

```text
.codex/
├── hooks.json
└── hooks/
    ├── user_prompt_submit_intake.js
    ├── session_start_restore.js
    └── shared/
        ├── codex-hook-io.js
        ├── task-intake-heuristics.js
        └── state-bridge.js
```

建议职责：

- `user_prompt_submit_intake.js`
  - 读取 hook stdin
  - 判定新任务 / 续写 / 歧义
  - 调用 intake bridge
  - 输出 `additionalContext` 或 `block`
- `session_start_restore.js`
  - 恢复 active task 摘要
  - 输出 `additionalContext`
- `state-bridge.js`
  - 复用 Node CLI 的 state 能力
  - 封装“挂起旧任务 + 创建新任务”

## 13. CLI 配套要求

虽然自动 intake 是宿主能力，但 CLI 仍需补两个配套点：

1. 一个可复用的 `task intake` 内部能力
   - 供 hook 脚本调用
   - 也作为手动 fallback
2. 一个最小的 `suspend-active-task` 能力
   - 避免 hook 直接手改 state JSON

因此后续实现不应让 hook 脚本直接操作 JSON 文件，而应尽量通过 Node CLI 或共享 JS 库完成状态写入。

## 14. 风险

### 14.1 误判新任务

风险：

- 用户只是延续旧任务，但被错误切成新任务

缓解：

- 对“继续、修一下、补测试”类 follow-up 词保守处理
- 低置信度时优先 clarify，而不是直接切题

### 14.2 自动化过度自信

风险：

- 为了自动 intake 而编造 scope / acceptance

缓解：

- 缺字段时进入 `needs_clarification`
- 不允许生成虚假的闭合合同

### 14.3 Hook 失败导致体验崩坏

风险：

- hook 报错后每轮都阻塞交互

缓解：

- 默认 fail open
- 仅在高风险且可解释时 block

## 15. 推荐实施顺序

### Phase 1

- 新增本设计稿
- 确认 Codex 自动 intake 的最小契约
- 明确 `.codex/hooks.json` 的 repo-local 方案

### Phase 2

- 实现 Node 版 `task intake` 底层能力
- 实现 `suspend-active-task` 最小能力
- 实现可被 hook 调用的共享 JS bridge

### Phase 3

- 接入 `UserPromptSubmit`
- 接入 `SessionStart`
- 在真实 Codex 会话中验证“续写 / 新任务 / 歧义”三条路径

## 16. 最终决策

对 `Codex` 而言，自动 intake 应被定义为：

- 主路径：`UserPromptSubmit` 自动触发
- 恢复路径：`SessionStart` 自动恢复
- 兜底路径：手动 `task intake`

也就是说：

- `task intake` 不是用户主入口
- `Codex hook` 才是主入口
- CLI 负责提供可复用的状态与 intake 内核
