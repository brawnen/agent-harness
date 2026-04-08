## Codex 宿主说明

> **注意**：当前项目通过根目录 `.codex/config.toml` 与 `.codex/hooks.json` 暴露 Codex 宿主入口，但真实源文件位于 `.harness/hosts/codex/`。即便有 hook，执行门禁仍不能只依赖 hook，本规则（L2）依旧有效。

### Codex 自动模式

当前项目已提供 repo-local Codex hooks：

- `SessionStart`：恢复 active task 摘要
- `UserPromptSubmit`：自动 intake / continue / clarify / override

当前默认只启用最小 hook 集合。工具级 `PreToolUse / PostToolUse` 虽保留实现，但默认关闭，以降低宿主前台噪音。

建议在当前仓库中使用：

- `codex`
- `codex exec ...`

若项目未被 Codex 视为 trusted project，仍可显式使用：

- `codex --enable codex_hooks`
- `codex exec --enable codex_hooks ...`
