# agent-harness

[中文](README.md)

`agent-harness` is a task-convergence protocol and toolchain for hosts such as `Codex`, `Claude Code`, and `Gemini CLI`.

It is not about making an agent “better at coding”. It is about making an agent behave predictably in a real project:

- work within confirmed scope
- keep task state explicit
- require verification before claiming completion
- close the loop with reports, gating, and delivery policies

Today, the most complete host integration is `Codex`, backed by:

- `protocol` for rules, schemas, templates, and adapter guidance
- `cli` for `init / status / task / state / verify / report / gate / audit / delivery / docs`
- `Codex hooks` for automatic intake, pre-tool gating, post-tool evidence, and session restore

## Why Agent Harness

Most coding agents look strong in demos, but in real repositories they often:

- lose track of whether the current prompt still belongs to the same task
- start editing before the task is actually closed enough
- write outside confirmed scope
- skip verification evidence
- claim completion without a report or delivery boundary

`agent-harness` adds a minimal but explicit engineering contract around those behaviors:

- `intake / clarify / observe / verify / report`
- `state / audit / gate / delivery`
- `protected_paths / risk_rules / output_policy / delivery_policy`

## Two Ways To Use It

### 1. Protocol only

Use this if you:

- only want behavior rules
- do not want to install the CLI yet
- want the lowest-friction way to try it in an existing repo

How:

1. Copy [packages/protocol/rules/base.md](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/rules/base.md) or [packages/protocol/rules/full.md](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/rules/full.md) into `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md`
2. Reuse:
   - [packages/protocol/templates](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/templates)
   - [packages/protocol/schemas](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/schemas)
   - [packages/protocol/adapters](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/adapters)

You get:

- rules for intake / clarify / observe / verify / report
- task templates and schemas
- host adapter examples

### 2. Protocol + CLI

Use this if you want:

- persistent task state
- pre-tool gating and audit logs
- a real delivery close-out path

Current local entrypoint from this repository:

```bash
node packages/cli/bin/agent-harness.js init --dry-run
node packages/cli/bin/agent-harness.js init --host codex
node packages/cli/bin/agent-harness.js status
```

Target published entrypoint in the future:

```bash
npx @agent-harness/cli init
npx @agent-harness/cli init --protocol-only
```

Notes:

- the project is not published to npm yet
- any `npx @agent-harness/cli ...` command in this README describes the target distribution shape, not a currently available package
- local usage requires `Node.js >= 18`

## Quick Start

### Protocol only

1. Copy the rules into `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`
2. Reuse templates and schemas as needed
3. Start using the host with those rules in place

### Local CLI

If you want to try the current CLI in another repo before npm publishing, use the local path directly:

```bash
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js init --host codex
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js status
```

### Codex

This repository already includes:

- [.codex/config.toml](/Users/lijianfeng/code/pp/agent-harness/.codex/config.toml)
- [.codex/hooks.json](/Users/lijianfeng/code/pp/agent-harness/.codex/hooks.json)
- [.codex/hooks/user_prompt_submit_intake.js](/Users/lijianfeng/code/pp/agent-harness/.codex/hooks/user_prompt_submit_intake.js)
- [.codex/hooks/session_start_restore.js](/Users/lijianfeng/code/pp/agent-harness/.codex/hooks/session_start_restore.js)
- [.codex/hooks/pre_tool_use_gate.js](/Users/lijianfeng/code/pp/agent-harness/.codex/hooks/pre_tool_use_gate.js)
- [.codex/hooks/post_tool_use_record_evidence.js](/Users/lijianfeng/code/pp/agent-harness/.codex/hooks/post_tool_use_record_evidence.js)

In this repository, you can just run:

```bash
codex
```

or:

```bash
codex exec "continue the current task"
```

Current Codex integration includes:

- `SessionStart` for restoring active task context
- `UserPromptSubmit` for intake / continue / clarify / override
- `PreToolUse` for `gate before-tool`
- `PostToolUse` for automatic evidence capture

## Current Status

`Codex` is currently the most complete host.

The following minimum loop is already working:

- `task intake / confirm / suspend-active`
- `state`
- `verify`
- `report`
- `gate`
- `audit`
- `delivery ready / request / commit`
- `docs scaffold`
- `Codex` hooks for `SessionStart / UserPromptSubmit / PreToolUse / PostToolUse`

Current boundaries:

- `commit`: supported as an explicit action, recommended via skill
- `push`: manual only, not automated
- `Bash` pre-tool path inference only covers high-confidence common write commands
- more complex shell syntax still degrades conservatively

## Repository Layout

```text
.
├── docs/           # design docs, ADRs, roadmap, policy docs
├── packages/
│   ├── protocol/   # rules / schemas / templates / adapters
│   └── cli/        # Node.js CLI
├── harness/        # runtime state / audit / reports / schemas / tasks
└── package.json    # workspace root config
```

## Current Commands

`packages/cli` currently includes these core commands:

- `init`
- `status`
- `task`
- `state`
- `verify`
- `report`
- `gate`
- `audit`
- `delivery`
- `docs`

For command-level details, see:

- [packages/cli/README.md](/Users/lijianfeng/code/pp/agent-harness/packages/cli/README.md)
- [packages/protocol/README.md](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/README.md)

## What Is Still Missing Before Broader Open Source Adoption

The project is already usable for you or an internal team, but it is not yet at the “low-friction public open source adoption” stage.

Main remaining work:

- npm publishing and versioned distribution
- tighter README / Quick Start polish
- more host coverage
  - `Claude Code`
  - `Gemini CLI`
  - `Antigravity`
- stronger CI / release flow
- more host E2E coverage and misclassification fixtures

## Documentation

- [Agent Harness Design v0.3](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-03-agent-harness-design-v0.3.md)
- [Open Source Architecture ADR](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-02-agent-harness-open-source-architecture-adr-v0.1.md)
- [Codex Auto Intake Design](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-03-codex-auto-intake-design-v0.1.md)
- [Codex Hooks Workflow](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-03-codex-hooks-workflow-v0.1.md)
- [Codex v0.3 Roadmap](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-04-codex-v0.3-roadmap.md)
- [CHANGELOG Maintenance Policy](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-04-changelog-maintenance-policy-v0.1.md)
- [Task Core Misclassification Fixture Workflow](/Users/lijianfeng/code/pp/agent-harness/docs/2026-04-03-task-core-misclassification-fixture-workflow-v0.1.md)
- [CLI README](/Users/lijianfeng/code/pp/agent-harness/packages/cli/README.md)
- [Protocol README](/Users/lijianfeng/code/pp/agent-harness/packages/protocol/README.md)

Historical drafts and early specifications are archived under [`docs/archive/`](/Users/lijianfeng/code/pp/agent-harness/docs/archive).
