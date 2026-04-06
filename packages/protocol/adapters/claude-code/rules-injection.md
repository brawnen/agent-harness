# Claude Code Rules Injection

建议将 `rules/full.md` 或 `rules/base.md` 注入项目的 `CLAUDE.md`。

推荐顺序：

1. 先注入规则文本
2. 再按需配置 hooks
3. 最后由 CLI 接管项目初始化

当前阶段说明：

- `init --host claude-code` 当前已经会生成 `CLAUDE.md` 规则块并合并 `.claude/settings.json`
- `Claude Code` 当前支持 `PreToolUse / PostToolUse` 的工具级 hooks
- `Claude Code` 仍不具备 `SessionStart / UserPromptSubmit` 这类 response-level 自动 intake 能力
- 若要让 hooks 在目标项目里稳定可用，推荐在项目内安装 `@brawnen/agent-harness-cli`；模板中的 `npx @brawnen/agent-harness-cli ...` 也可作为零预装 fallback
