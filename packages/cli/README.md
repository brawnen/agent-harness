# @agent-harness/cli

这是 `agent-harness` 的 Node.js CLI。

当前已完成：

- 可执行入口
- `init` MVP
- `status` MVP
- `verify` MVP
- `state` MVP
- `report` MVP
- `gate` MVP
- `audit` MVP
- `--dry-run`
- `--protocol-only`
- 宿主规则注入
- 基础项目配置生成

还未完成：

- 更深的宿主集成

`init` MVP 当前负责：

- 检测项目类型
- 检测宿主类型
- 生成 `harness.yaml`
- 复制协议任务模板到 `harness/tasks/`
- 注入 `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` 规则块
- 在非 `--protocol-only` 模式下生成运行时目录和 Claude Code hooks

当前不负责：

- 完整状态管理迁移
- 完整 gate / audit / report 迁移
- 复杂升级与深度 merge

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

设计约束：

- CLI 依赖 `@agent-harness/protocol`
- 未来默认入口是 `npx @agent-harness/cli init`
- 历史 Ruby CLI 在迁移期继续作为参考实现
