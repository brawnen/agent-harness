# @agent-harness/cli

这是 `agent-harness` 的 Node.js CLI。

当前已完成：

- 可执行入口
- `task` MVP
- `init` MVP
- `status` MVP
- `verify` MVP
- `state` MVP
- `report` MVP
- `gate` MVP
- `audit` MVP
- `docs` MVP
- `--dry-run`
- `--protocol-only`
- 宿主规则注入
- 基础项目配置生成
- `.codex/hooks.json` 最小方案

还未完成：

- 更深的宿主集成

`init` MVP 当前负责：

- 检测项目类型
- 检测宿主类型
- 生成 `harness.yaml`
- 复制协议任务模板到 `harness/tasks/`
- 注入 `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` 规则块
- 在非 `--protocol-only` 模式下生成运行时目录和 Claude Code hooks

`task` MVP 当前负责：

- `task intake "<任务描述>"`
- `task confirm`
- `task suspend-active`
- 从自然语言生成最小 task draft
- 将 task draft 闭合为 confirmed contract
- 在可选 `--suspend-active` 时挂起旧任务
- 为 Codex hook 提供可复用的 intake / suspend 内核

当前不负责：

- 完整状态管理迁移
- 完整 gate / audit / report 迁移
- 复杂升级与深度 merge

`task-core` 当前已经补了最小分类回归样本，可在本地运行：

```bash
npm --prefix packages/cli run verify:task-core
```

这组样本当前覆盖：

- `matched_continue_keyword`
- `matched_new_task_keyword`
- `matched_active_goal_fragment`
- `matched_active_scope`
- `ambiguous_high_risk_prompt`
- `fallback_new_task`
- `inactive_active_task_state`
- `no_active_task`

`status` MVP 当前负责：

- 检查 `harness.yaml`
- 检查宿主规则块
- 检查任务模板目录
- 检查 Claude Code hooks
- 检查运行时目录与 `.gitignore`
- 用退出码区分完整、警告和不完整

`verify` MVP 当前负责：

- 读取 `harness/state/index.json` 中的 active task，或显式 `--task-id`
- 读取 `harness/state/tasks/<task_id>.json`
- 按最小验证矩阵检查 `intent / evidence / open_questions / acceptance`
- 输出结构化 JSON 结果
- 用退出码区分允许完成和阻止完成

`state` MVP 当前负责：

- `state init`
- `state get`
- `state update`
- `state active`
- 维护 `harness/state/index.json`
- 维护 `harness/state/tasks/<task_id>.json`
- 复用最小合法状态迁移表

`report` MVP 当前负责：

- 读取 active task 或显式 `--task-id`
- 在生成报告前复用 `verify` 规则做完成门禁检查
- 写入 `harness/reports/<task_id>.json`
- 将任务状态推进到 `close / done`
- 根据 `output_policy` 校验 `CHANGELOG.md`、`design note`、`ADR` 等交付工件
- 根据 `delivery_policy` 计算 `commit-ready / push-ready`，并把 `delivery_readiness` 写进报告

`report` 额外支持：

- `--changelog-file <path>`
- `--design-note <path>`
- `--adr <path>`

`gate` MVP 当前负责：

- `gate before-tool`
- 基于 active task 或显式 `--task-id` 做确定性门禁判断
- 检查写入工具的任务状态是否合法
- 检查 `protected_paths`
- 检查路径是否越过 path-like scope
- 在高风险且未确认时返回 `require_confirmation`

`audit` MVP 当前负责：

- `audit append`
- `audit read`
- 写入 `harness/audit/<task_id>.jsonl`
- 让 `gate` 记录最小 `gate_violation`
- 让 `report` 读取 `force_override/manual_confirmation` 作为 `overrides_used`

`delivery_policy` 第一版当前负责：

- 在 `status` 中展示 active task 的 `commit-ready / push-ready`
- 在 `report` 中输出 `delivery_readiness`
- 提供 `delivery ready`、`delivery request --action commit|push` 和 `delivery commit` 入口
- `commit` 保留为 skill 化的显式动作
- `push` 保留为人工动作，不作为 skill 默认能力
- 当前只做 readiness 计算，不会自动执行 `git commit` 或 `git push`
- `commit_exists` 目前仍是保守信号，默认不会自动判定为 true

`delivery commit` 当前行为：

- 先复用 `delivery request --action commit`
- 读取任务报告中的 `actual_scope` 和 `output_artifacts`
- 目录型 scope 只会展开为当前有变更的文件
- 支持 `--dry-run` 先预览提交计划
- 对明显过宽的目录 scope 默认阻断，需显式使用 `--force-wide-scope`
- 自动执行本地 `git add` / `git commit`
- 永远不会执行 `git push`

`docs scaffold` 当前行为：

- 提供 `docs scaffold --type design-note|adr`
- 默认读取 active task，也支持 `--task-id`
- 根据任务上下文生成最小 Markdown 骨架
- 默认写入 `output_policy.design_note.directory` 或 `output_policy.adr.directory`
- 支持 `--path` 自定义目标路径
- 已存在文件默认阻止覆盖，需显式使用 `--force`

当 `report` 因缺少 `design_note` 或 `adr` 被阻断时：

- 会直接输出对应的 `docs scaffold` 建议命令
- 并给出重新执行 `report` 时应补的 `--design-note` / `--adr` 参数

`status` 当前也会对 active task 主动给出 output artifact 提示：

- 若当前任务要求 `changelog / design_note / adr`
- 会直接提示建议补齐的工件
- 对 `design_note / adr` 会给出可直接执行的 `docs scaffold` 命令

Codex 自动 evidence：

- 当前仓库在 `Codex` 下已为 `Bash` 接入 `PostToolUse`
- 常见 Bash 命令结果会自动追加到 active task 的 `evidence`
- 若命令明显属于测试，或任务当前处于 `verify` 阶段，则会优先记录为 `test_result`
- 在高风险任务上，`UserPromptSubmit` 会把显式确认语句自动记录为 `manual_confirmation`
- `别问了直接做`、`跳过验证` 这类显式 override 语句会自动记录为 `force_override`

Codex `PreToolUse` 当前行为：

- 会在 `Write / Edit / NotebookEdit / Bash` 前调用 `gate before-tool`
- `needs_clarification / draft / blocked / failed / done / suspended` 状态下的写入会被前置阻断
- 会结合 task state 与 `harness.yaml risk_rules.path_matches` 动态判断高风险写入
- 高风险写入且未确认时，会在工具执行前阻断并要求先确认
- 当前对 `Write / Edit / NotebookEdit` 的路径识别更可靠；`Bash` 的路径级判断取决于宿主 payload 是否提供目标路径

本地验证提示：

- 如果当前工作目录不是仓库根目录，调用 CLI 时应使用绝对路径，例如：

```bash
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js audit read --task-id <task-id>
```

- 不要在临时目录里直接运行相对路径 `node packages/cli/bin/agent-harness.js ...`，否则容易把路径错误误判成命令读取异常

Codex E2E 回归：

- 可执行 `npm --prefix packages/cli run verify:codex-e2e`
- 或在仓库根目录执行 `npm run codex:e2e`
- 当前最小回归覆盖：新任务自动 intake、follow-up 不误切、高风险确认链路、hook 降级提示
- 当前回归采用“真实 `codex exec` smoke + hook 主链路回归”混合方式，优先验证我们自己的接入链路
- 当前脚本会在**当前 trusted 仓库**里执行真实 Codex 回归，并清理自己创建的 task/audit/report 文件
- 运行前要求当前仓库没有 active task

设计约束：

- CLI 依赖 `@agent-harness/protocol`
- 未来默认入口是 `npx @agent-harness/cli init`
- 当前仓库以 Node.js CLI 作为唯一主线实现
