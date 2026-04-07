# Gemini CLI Rules Injection

Gemini CLI 当前采用 `GEMINI.md` 规则注入 + `.gemini/settings.json` hooks 的接入方式。

推荐接入方式：

1. 在目标项目执行 `npx @brawnen/agent-harness-cli init --host gemini-cli`
2. CLI 会生成：
   - `harness.yaml`
   - `.harness/tasks/`
   - `.harness/state/`、`.harness/audit/`、`.harness/reports/`
   - `GEMINI.md` 中的 agent-harness managed rules block
   - `.gemini/settings.json` 中的 hook 配置
3. Gemini CLI 在运行时通过 hooks 接入：
   - `SessionStart`
   - `BeforeAgent`
   - `BeforeTool`
   - `AfterTool`
   - `AfterAgent`
4. `GEMINI.md` 仍负责 L2 行为规则，状态持久化、验证、报告与交付收口继续通过 CLI 状态机承接

当前支持边界：

- 有 `GEMINI.md` 规则注入
- 有 `.gemini/settings.json` hook 配置
- 有 `.harness` 运行时目录与 CLI 状态机
- 有 `SessionStart / BeforeAgent / BeforeTool / AfterTool / AfterAgent` 的最小 hook 闭环
- `gate / audit / verify / report / delivery` 仍由 CLI 核心逻辑提供
