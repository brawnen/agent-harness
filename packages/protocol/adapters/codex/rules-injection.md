# Codex Rules Injection

建议将 `rules/full.md` 或 `rules/base.md` 注入项目根目录 `AGENTS.md`。

当前阶段：

- Codex 仍以 L2 规则约束为基础
- 当前仓库已经内置 repo-local `.codex/hooks.json`
- 当前仓库也已通过 `.codex/config.toml` 默认设置 `features.codex_hooks = true`
- 自动 intake 通过 `UserPromptSubmit` 接入，active task 恢复通过 `SessionStart` 接入
- 使用前需启用 `codex_hooks` feature flag
- 若项目为 trusted project，可直接依赖项目级配置，无需每次手动 `--enable`
- 当前最小 hooks 方案优先接 `UserPromptSubmit` 和 `SessionStart`
- 自动 intake 失败时应降级到 `task intake` / `task suspend-active`
- 宿主级执行/完成门禁仍依赖后续 CLI 与宿主能力演进
- `@agent-harness/cli init --host codex` 后续应负责自动写入 `AGENTS.md` 与 `.codex/hooks.json`
