# Design Note: 收口 Codex PreToolUse 的 Bash 路径识别增强，并提交本地 commit

## 背景

- task_id: `p22-bash-patterns-commit`
- intent: `feature`
- risk_level: `low`

## 目标

- 收口 Codex PreToolUse 的 Bash 路径识别增强，并提交本地 commit

## 作用范围

- .codex/hooks/pre_tool_use_gate.js
- packages/cli/README.md
- CHANGELOG.md
- docs/p22-bash-patterns-commit-design-note.md

## 方案

- 保持 `PreToolUse -> gate before-tool` 这条标准门禁链路不变，只增强 `.codex/hooks/pre_tool_use_gate.js` 的高置信路径提取。
- 继续坚持“只识别常见、单目标、低歧义的写命令”，无法确认目标路径时保守降级为状态级门禁，不伪造路径。
- 本轮重点收口的模式分两类：
  - 已通过现有通用规则覆盖但需要补充验证和文档说明的模式：`cat <<EOF > file`、`printf ... | tee file`、`install -Dm644 src dst`、带引号的 `dd of=\"file\"`
  - 之前已补进实现并在本轮一并收口的模式：`chmod/chown/chgrp`、`truncate -s`、`install -d/-m/-D`、`rsync ... dst`
- README 同步记录当前支持的高置信 Bash 模式，降低后续维护和 review 成本。

## 风险与权衡

- 这不是通用 shell parser，复杂命令如 `find -exec`、变量展开、多段管道和组合命令仍然不做强行识别。
- 对远端目标或无法可靠落地到本地路径的命令，继续保守降级，避免误把无关路径交给 `gate`。
- 继续扩展模式时，应优先增加高价值、单目标、工程里常见的副作用命令，避免无限扩语法。

## 验证计划

- `node --check .codex/hooks/pre_tool_use_gate.js`
- 手工 payload 验证：
  - `cat <<EOF > src/app.ts` 在高风险路径上被前置阻断
  - `printf ok | tee docs/note.md` 在低风险 scope 内继续执行
  - `install -Dm644 docs/note.md docs/note.md` 继续执行
  - `dd if=/dev/zero of=\"src/app.ts\" ...` 在高风险路径上被前置阻断
