# Harness Config Schema v0.3 更新方案

## 1. 目标

把当前 `harness.yaml` 的真实使用方式、`Agent Harness 设计文档 v0.3` 的设计结论，以及 `Harness Config Policy Extension Draft v0.1` 中的策略扩展草案，收敛成一版 `harness-config.schema.json v0.3` 的更新方案。

这份文档的目标不是直接改 schema，而是先冻结：

- `v0.3` 应该长什么样
- 与当前 `v0.2` schema 的差异在哪里
- 迁移时如何兼容

## 2. 当前输入来源

本方案综合以下 4 个来源：

1. 当前 schema：
   - [harness-config.schema.json](packages/protocol/schemas/harness-config.schema.json)

2. 当前真实配置：
   - [harness.yaml](harness.yaml)

3. 当前实现：
   - [init.js](packages/cli/src/commands/init.js)
   - [project-config.js](packages/cli/src/lib/project-config.js)

4. 最新设计结论：
   - [Agent Harness 设计文档 v0.3](docs/2026-04-03-agent-harness-design-v0.3.md)
   - [Harness Config Policy Extension Draft v0.1](docs/2026-04-03-harness-config-policy-extension-draft-v0.1.md)

## 3. 当前 v0.2 schema 的主要问题

## 3.1 schema 与真实配置结构不一致

当前 `harness-config.schema.json` 中：

- `schema_version` 是必填
- `risk_rules` 是数组
- `default_commands` 是固定键对象
- `task_templates` 是 `{ directory, inject_phase }`
- `skill_policy` 是数组
- `output_policy` 只支持 `report_format` / `report_directory`

但当前真实 [harness.yaml](harness.yaml) 中：

- 顶层字段叫 `version`，不是 `schema_version`
- `risk_rules` 是按 `high / medium / low` 分组对象
- `default_commands` 是按 `delivery / explore / poc` 分组
- `task_templates` 是 `bug / feature / explore` 的映射
- `skill_policy` 是按 `intent -> phase -> prefer` 的嵌套对象
- `output_policy` 目前只有 `required_sections`

结论：

当前 schema 更像早期理想结构，而不是当前仓库的真实配置契约。

## 3.2 schema 没覆盖 v0.3 新增策略

以下内容在 `v0.3` 设计中已经存在，但当前 schema 完全没有表达：

- `delivery_policy.commit`
- `delivery_policy.push`
- `output_policy.report`
- `output_policy.changelog`
- `output_policy.design_note`
- `output_policy.adr`

## 3.3 schema 过早把若干字段定死成单一形态

例如：

- `default_commands`
- `risk_rules`
- `task_templates`
- `skill_policy`

这些字段当前在真实项目里已经表现出“项目自定义结构”的趋势，继续强行压成过窄结构，只会让 schema 越来越脱离现实。

## 4. v0.3 schema 设计目标

`harness-config.schema.json v0.3` 应满足 4 个目标：

1. 对齐当前仓库真实配置风格
2. 覆盖 `delivery_policy / output_policy` 新增策略
3. 保留必要的过渡兼容能力
4. 为 `init`、`status`、`project-config` 后续迁移提供稳定目标

## 5. 字段调整建议

## 5.1 顶层版本字段

### 当前问题

- 旧 schema 使用 `schema_version`
- 当前真实配置使用 `version`

### v0.3 建议

推荐统一为：

```yaml
version: "0.3"
```

schema 应允许：

- `version`

并将以下策略作为过渡兼容：

- `schema_version: "0.2"` 仅在迁移期兼容读取
- 新生成配置只写 `version`

## 5.2 `project_name`

### 当前状态

真实配置中已存在，schema 中没有定义。

### v0.3 建议

新增：

- `project_name: string`

要求：

- 非必填
- 仅用于标识项目，不参与 gate 语义

## 5.3 `project_type`

### 当前状态

schema 中已有，但枚举值与真实仓库中的 `protocol-tooling` 不兼容。

### v0.3 建议

保留 `project_type`，并扩展枚举值：

- `frontend`
- `backend`
- `fullstack`
- `library`
- `infra`
- `monorepo`
- `protocol-tooling`
- `other`

## 5.4 `default_mode`

### 当前状态

schema 与真实配置基本一致。

### v0.3 建议

保留，结构不变：

- `delivery`
- `explore`
- `poc`

## 5.5 `allowed_paths` / `protected_paths`

### 当前状态

schema 与真实配置基本一致。

### v0.3 建议

保留，结构不变。

这是当前最稳定的一组字段，不建议继续折腾。

## 5.6 `default_commands`

### 当前问题

旧 schema 只允许：

- `type_check`
- `lint`
- `test`
- `build`

但当前真实配置按模式组织：

- `delivery`
- `explore`
- `poc`

### v0.3 建议

改为按 `mode` 组织：

```yaml
default_commands:
  delivery:
    - "..."
  explore:
    - "..."
  poc:
    - "..."
```

建议结构：

- `default_commands`
  - `delivery?: string[]`
  - `explore?: string[]`
  - `poc?: string[]`

迁移说明：

- 旧结构不再作为 `v0.3` 目标结构
- 若要兼容，可在读取层做一次性升级映射

## 5.7 `risk_rules`

### 当前问题

旧 schema 要求数组：

```yaml
risk_rules:
  - pattern: "..."
    level: high
```

当前真实配置使用分级对象：

```yaml
risk_rules:
  high:
    path_matches:
      - ...
    requires_confirmation: true
    minimum_evidence:
      - ...
```

### v0.3 建议

改为按风险等级分组：

- `high`
- `medium`
- `low`

每个等级对象建议字段：

- `path_matches: string[]`
- `requires_confirmation: boolean`
- `minimum_evidence: string[]`
- `reason?: string`

这样更贴近当前 gate 语义，也更容易在文档中表达。

## 5.8 `task_templates`

### 当前问题

旧 schema 把它定义成目录配置对象，但当前真实配置是 intent 到模板路径的映射。

### v0.3 建议

改为显式映射：

```yaml
task_templates:
  bug: harness/tasks/bug.md
  feature: harness/tasks/feature.md
  explore: harness/tasks/explore.md
```

推荐允许：

- `bug`
- `feature`
- `explore`
- `refactor`
- `prototype`

## 5.9 `skill_policy`

### 当前问题

旧 schema 把它压成数组：

- `skill_name`
- `action`

但当前真实配置已经是：

- `intent -> phase -> prefer/force/deny -> skill[]`

### v0.3 建议

改为嵌套对象结构：

```yaml
skill_policy:
  bug:
    clarify:
      prefer:
        - systematic-debugging
```

推荐最外层允许：

- `bug`
- `feature`
- `explore`
- `refactor`
- `prototype`

每个 intent 下允许 phase：

- `clarify`
- `plan`
- `execute`
- `verify`
- `report`

每个 phase 下允许动作：

- `prefer`
- `force`
- `deny`

## 5.10 `output_policy`

### 当前问题

旧 schema 只有：

- `report_format`
- `report_directory`

当前真实配置只有：

- `required_sections`

这两者都不够表达 `v0.3` 的设计目标。

### v0.3 建议

统一升级为对象结构：

#### `output_policy.report`

建议字段：

- `required: boolean`
- `format: json|yaml|markdown`
- `directory: string`
- `required_sections: string[]`

#### `output_policy.changelog`

建议字段：

- `mode: disabled|optional|required|conditional`
- `file: string`
- `required_for: string[]`
- `skip_if?: object[]`

#### `output_policy.design_note`

建议字段：

- `mode: disabled|optional|required|conditional`
- `directory: string`
- `required_if: (string|object)[]`

#### `output_policy.adr`

建议字段：

- `mode: disabled|optional|required|conditional`
- `directory: string`
- `required_if: (string|object)[]`

## 5.11 `delivery_policy`

### 当前状态

当前 schema 完全没有这个字段。

### v0.3 建议

新增顶层对象：

#### `delivery_policy.commit`

建议字段：

- `mode: disabled|explicit_only|allow_if_ready`
- `via: skill|manual|cli`
- `require: string[]`
- `message?: object`

#### `delivery_policy.push`

建议字段：

- `mode: disabled|explicit_only`
- `via: skill|manual`
- `require: string[]`

## 6. v0.3 推荐目标结构

推荐 `harness-config.schema.json v0.3` 的顶层结构为：

```yaml
version: "0.3"
project_name: agent-harness
project_type: protocol-tooling
languages:
  - markdown
  - yaml

default_mode: delivery

allowed_paths:
  - packages/**
  - docs/**
  - .codex/**

protected_paths:
  - .idea/**

default_commands:
  delivery:
    - "..."
  explore:
    - "..."
  poc:
    - "..."

risk_rules:
  high:
    path_matches:
      - AGENTS.md
      - harness.yaml
    requires_confirmation: true
    minimum_evidence:
      - diff_summary
      - manual_confirmation

task_templates:
  bug: harness/tasks/bug.md
  feature: harness/tasks/feature.md
  explore: harness/tasks/explore.md

skill_policy:
  feature:
    execute:
      prefer:
        - safe-editing

delivery_policy:
  commit:
    mode: explicit_only
    via: skill
    require:
      - verify_passed
      - report_generated

  push:
    mode: explicit_only
    via: skill
    require:
      - commit_exists

output_policy:
  report:
    required: true
    format: json
    directory: harness/reports
    required_sections:
      - task_conclusion
      - actual_scope
      - verification_evidence
      - remaining_risks
      - next_steps

  changelog:
    mode: conditional
    file: CHANGELOG.md
    required_for:
      - bug
      - feature
      - refactor
```

## 7. 兼容策略

## 7.1 兼容目标

迁移时应保证：

- 当前 `harness.yaml` 不会立即失效
- 当前 `init` 仍可工作
- 当前 `status` / `gate` 不因 schema 升级而立即崩掉

## 7.2 推荐兼容方式

### 顶层版本

- 读取层兼容：
  - `schema_version: "0.2"`
  - `version: "0.2" | "0.3"`

- 新写入统一生成：
  - `version: "0.3"`

### `output_policy`

兼容迁移规则：

```yaml
output_policy:
  required_sections: [...]
```

迁移为：

```yaml
output_policy:
  report:
    required_sections: [...]
```

### `risk_rules`

不建议在 `v0.3` schema 中同时正式支持数组版和分组对象版。

更合理的做法是：

- schema 只定义新结构
- 读取层在过渡期兼容旧结构并升级为新结构

### `default_commands`

同样建议：

- schema 只定义 mode-based 结构
- 读取层短期做旧结构升级

## 8. 字段状态总表

### 8.1 保留

- `project_type`
- `default_mode`
- `allowed_paths`
- `protected_paths`
- `languages`

### 8.2 变更形态

- `schema_version -> version`
- `default_commands`
- `risk_rules`
- `task_templates`
- `skill_policy`
- `output_policy`

### 8.3 新增

- `project_name`
- `delivery_policy`
- `output_policy.report`
- `output_policy.changelog`
- `output_policy.design_note`
- `output_policy.adr`

### 8.4 废弃

以下旧结构在 `v0.3` 中不应继续作为目标结构：

- `schema_version`
- `output_policy.report_format`
- `output_policy.report_directory`
- 数组版 `risk_rules`
- 固定键版 `default_commands`
- 数组版 `skill_policy`

## 9. 推荐落地顺序

1. 先更新 `harness-config.schema.json`
2. 再更新 `init` 生成逻辑
3. 再更新 `project-config` 读取与兼容升级
4. 最后再决定：
   - `status` 是否检查 `delivery_policy / output_policy`
   - `verify` 是否开始消费 `output_policy`
   - skill 是否开始消费 `delivery_policy`

## 10. 明确边界

这份更新方案不代表以下能力已经实现：

- `delivery_policy.commit` 已被 CLI 消费
- `delivery_policy.push` 已被 CLI 消费
- `CHANGELOG.md` 已被自动检查
- `design note / ADR` 已被自动强制

它只定义：

- 下一版 schema 应该长什么样
- 迁移时应该如何收口
