# Claude Code Rules Injection

建议将 `rules/full.md` 或 `rules/base.md` 注入项目的 `CLAUDE.md`。

推荐顺序：

1. 先注入规则文本
2. 再按需配置 hooks
3. 最后由 CLI 接管项目初始化

当前阶段说明：

- 本目录只提供协议层接入示例
- 未来正式命令以 `@brawnen/agent-harness-cli init` 为准
