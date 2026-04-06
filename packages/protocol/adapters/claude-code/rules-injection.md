# Claude Code Rules Injection

建议将 `rules/full.md` 或 `rules/base.md` 注入项目的 `CLAUDE.md`。

推荐顺序：

1. 先注入规则文本
2. 再按需配置 hooks
3. 最后由 CLI 接管项目初始化

当前阶段说明：

- `init --host claude-code` 当前已经会生成 `CLAUDE.md` 规则块并合并 `.claude/settings.json`
- `Claude Code` 当前已接入 `SessionStart / UserPromptSubmit / PreToolUse / PostToolUse / Stop`
- `SessionStart` 用于恢复 active task 摘要，`UserPromptSubmit` 用于 intake / continue / clarify / override
- `Stop` 当前承担最小完成门禁：当模型明显宣称任务完成时，要求先补齐 verify / report
- `PreToolUse / PostToolUse` 继续负责工具级 gate 与工具后状态更新
- 若要让 hooks 在目标项目里稳定可用，推荐在项目内安装 `@brawnen/agent-harness-cli`；模板中的 `npx @brawnen/agent-harness-cli ...` 也可作为零预装 fallback
