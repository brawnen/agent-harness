# Gemini CLI Rules Injection

Gemini CLI 当前采用 `GEMINI.md` 规则注入的 L2 接入方式，无原生 hooks。

推荐接入方式：

1. 在目标项目执行 `npx @brawnen/agent-harness-cli init --host gemini-cli`
2. CLI 会生成：
   - `harness.yaml`
   - `.harness/tasks/`
   - `.harness/state/`、`.harness/audit/`、`.harness/reports/`
   - `GEMINI.md` 中的 agent-harness managed rules block
3. Gemini CLI 在运行时主要依赖 `GEMINI.md` 约束 intake / clarify / completion gate
4. 任务状态持久化、验证、报告与交付收口仍通过 CLI 手动执行

当前支持边界：

- 有 `GEMINI.md` 规则注入
- 有 `.harness` 运行时目录与 CLI 状态机
- 无 `SessionStart / UserPromptSubmit / PreToolUse / PostToolUse` 这类宿主原生 hook
- `gate / audit / verify / report / delivery` 仍由 CLI 提供
