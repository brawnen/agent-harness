## Gemini CLI 宿主说明

> **注意**：当前项目通过根目录 `.gemini/settings.json` 暴露 Gemini CLI 宿主入口，但真实源文件位于 `.harness/hosts/gemini/`。即便有 hook，执行门禁仍不能只依赖 hook，本规则（L2）依旧有效。

### Gemini CLI hook 接入

当前项目已提供：

- `SessionStart`
- `BeforeAgent`
- `BeforeTool`
- `AfterTool`
- `AfterAgent`

### Gemini CLI 宿主接入偏好

对于 `Gemini CLI` 宿主接入相关任务：

- 默认由 agent 自行完成方案、实现、验证与收口
- 不要在中途反复向用户确认实现细节
- 只有在高风险、超出已确认 scope、需要外部权限或不可逆操作时才追问用户
- 若存在普通实现分支，默认选择实现成本低、验证快、回滚简单的路径直接推进
