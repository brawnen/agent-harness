# Harness Config Policy Extension Draft v0.1

## 1. 目标

把 `Agent Harness 设计文档 v0.3` 中新增的交付收口策略，整理成一版面向 `harness.yaml` 的配置扩展草案。

本草案只解决两个问题：

- `delivery_policy`
- `output_policy`

这份文档是设计草案，不代表这些字段已经全部落地。

## 2. 先说当前现状

当前仓库中的配置层还没有完全收敛，至少存在三层现实：

1. 当前示例配置：
   - [harness.yaml](harness.yaml)

2. 当前 schema：
   - [harness-config.schema.json](packages/protocol/schemas/harness-config.schema.json)

3. 当前实现：
   - [init.js](packages/cli/src/commands/init.js)
   - [project-config.js](packages/cli/src/lib/project-config.js)

这三者目前并不完全一致。

因此这份草案的目标不是直接修改 schema，而是先定义一个更合理的目标配置结构，作为后续迁移基线。

## 3. 设计原则

### 3.1 Delivery 与 Output 分层

- `delivery_policy` 约束仓库动作
- `output_policy` 约束交付工件

前者回答：

- 什么时候允许 `commit`
- 什么时候允许 `push`
- 这些动作由谁执行

后者回答：

- 什么时候必须有 `report`
- 什么时候必须更新 `CHANGELOG.md`
- 什么时候必须补 `design note` 或 `ADR`

### 3.2 不把仓库治理硬编码到 harness core

`commit / push` 不应该作为 harness 核心协议的默认自动行为。

更合理的模型是：

- harness 判断任务是否 `close-ready`
- project policy 判断是否 `commit-ready`
- skill 或显式请求执行 `git commit / git push`

### 3.3 先声明策略，再决定执行层

本草案优先解决：

- 配置长什么样
- 每个字段语义是什么

不直接要求当前 CLI 立刻实现全部策略。

## 4. 提议结构

推荐在 `harness.yaml` 中扩展如下结构：

```yaml
delivery_policy:
  commit:
    mode: explicit_only
    via: skill
    require:
      - verify_passed
      - report_generated
    message:
      source: skill
      convention: optional

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

  changelog:
    mode: conditional
    file: CHANGELOG.md
    required_for:
      - bug
      - feature
      - refactor

  design_note:
    mode: conditional
    directory: docs/
    required_if:
      - cross_module_change
      - public_contract_changed
      - risk_level: high

  adr:
    mode: conditional
    directory: docs/
    required_if:
      - architectural_decision
      - policy_change
      - protocol_change
```

## 5. Delivery Policy 草案

## 5.1 `delivery_policy.commit`

推荐字段：

- `mode`
  - `disabled`
  - `explicit_only`
  - `allow_if_ready`

- `via`
  - `skill`
  - `manual`
  - `cli`

- `require`
  提交前必须满足的条件列表，例如：
  - `verify_passed`
  - `report_generated`
  - `changelog_updated`
  - `design_note_present`

- `message`
  用于约束 commit message 的来源与格式，例如：
  - `source: skill`
  - `convention: optional|conventional_commits|project_defined`

推荐默认值：

```yaml
commit:
  mode: explicit_only
  via: skill
  require:
    - verify_passed
    - report_generated
```

含义：

- 默认不自动 commit
- 只有用户显式要求才执行
- 推荐由 skill 承载 commit 动作

## 5.2 `delivery_policy.push`

推荐字段：

- `mode`
  - `disabled`
  - `explicit_only`

- `via`
  - `skill`
  - `manual`

- `require`
  例如：
  - `commit_exists`
  - `remote_confirmed`

推荐默认值：

```yaml
push:
  mode: explicit_only
  via: skill
  require:
    - commit_exists
```

含义：

- 默认绝不自动 push
- `push` 必须被视为远端协作动作，而不是普通任务收口动作

## 6. Output Policy 草案

## 6.1 `output_policy.report`

这部分和当前实现最接近。

推荐字段：

- `required`
- `format`
- `directory`
- `required_sections`

推荐默认值：

```yaml
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
```

说明：

- 这部分已经与当前 `report` 命令方向基本一致
- 当前仓库的旧 `output_policy.required_sections` 可以视为该对象的前身

## 6.2 `output_policy.changelog`

目标是把 `CHANGELOG.md` 从“个人习惯”提升为“项目工件策略”。

推荐字段：

- `mode`
  - `disabled`
  - `optional`
  - `required`
  - `conditional`

- `file`
  例如：`CHANGELOG.md`

- `required_for`
  例如：
  - `bug`
  - `feature`
  - `refactor`

- `skip_if`
  可选跳过条件

推荐默认值：

```yaml
changelog:
  mode: conditional
  file: CHANGELOG.md
  required_for:
    - bug
    - feature
    - refactor
```

说明：

- 不建议默认要求所有 `explore` 都写 changelog
- 也不建议把所有改动都强行写进 changelog，否则噪音过大

## 6.3 `output_policy.design_note`

目标是把复杂功能设计说明变成可配置工件。

推荐字段：

- `mode`
  - `disabled`
  - `optional`
  - `required`
  - `conditional`

- `directory`
  例如：`docs/`

- `required_if`
  推荐触发条件：
  - `cross_module_change`
  - `public_contract_changed`
  - `risk_level: high`
  - `reusable_decision`

推荐默认值：

```yaml
design_note:
  mode: conditional
  directory: docs/
  required_if:
    - cross_module_change
    - public_contract_changed
    - risk_level: high
```

说明：

- `design note` 适合描述复杂功能的实现方案
- 不应要求所有任务都写

## 6.4 `output_policy.adr`

目标是把架构决策沉淀显式纳入配置策略。

推荐字段：

- `mode`
  - `disabled`
  - `optional`
  - `required`
  - `conditional`

- `directory`
  例如：`docs/`

- `required_if`
  推荐触发条件：
  - `architectural_decision`
  - `policy_change`
  - `protocol_change`
  - `host_adapter_contract_change`

推荐默认值：

```yaml
adr:
  mode: conditional
  directory: docs/
  required_if:
    - architectural_decision
    - policy_change
    - protocol_change
```

说明：

- `ADR` 是 `Architecture Decision Record`
- 它记录的是“为什么这么选”，不是一般实现说明

## 7. 推荐目标配置示例

下面是一版更完整的目标形态示例：

```yaml
version: 0.3
project_name: agent-harness
project_type: protocol-tooling

default_mode: delivery

allowed_paths:
  - packages/**
  - docs/**
  - .codex/**
  - README.md
  - AGENTS.md
  - harness.yaml

protected_paths:
  - .idea/**

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

  design_note:
    mode: conditional
    directory: docs/
    required_if:
      - cross_module_change
      - public_contract_changed
      - risk_level: high

  adr:
    mode: conditional
    directory: docs/
    required_if:
      - architectural_decision
      - protocol_change
```

## 8. 当前实现映射

### 8.1 已实现

- `output_policy.report.required_sections`
  已有雏形
- `report` 产物写入 `harness/reports/`
  已实现

### 8.2 半实现

- `output_policy`
  已存在，但当前结构过于扁平
- `report` 相关语义已存在，但尚未作为完整对象解析

### 8.3 尚未实现

- `delivery_policy.commit`
- `delivery_policy.push`
- `output_policy.changelog`
- `output_policy.design_note`
- `output_policy.adr`

## 9. 推荐迁移顺序

不建议一步到位改全部层。

推荐顺序：

1. 先冻结目标配置结构
2. 更新 `harness-config.schema.json`
3. 更新 `init` 生成逻辑
4. 更新 `project-config` 解析层
5. 再决定哪些策略进入 `status` / `verify` / skill 执行层

## 10. 明确边界

这份草案不意味着以下能力已经存在：

- agent 会自动 commit
- agent 会自动 push
- `CHANGELOG.md` 已被当前 CLI 强制检查
- 复杂功能会自动生成 design note 或 ADR

这些都只是下一阶段的目标配置边界，而不是当前已实现行为。
