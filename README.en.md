# agent-harness

[中文](README.md)

`agent-harness` is a protocol and toolchain based on harness engineering for AI coding agent hosts such as `Codex`, `Claude Code`, and `Gemini CLI`.

It is not about making an agent “better at coding”. It is about making an agent behave predictably in a real project:

- work within confirmed scope
- keep task state explicit
- require verification before claiming completion
- close the loop with reports, gating, and delivery policies
- keep the interaction rhythm stable: plan before confirmation, execute after confirmation, no repeated final restatement

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

1. Copy [packages/protocol/rules/base.md](packages/protocol/rules/base.md) or [packages/protocol/rules/full.md](packages/protocol/rules/full.md) into `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md`
2. Reuse:
   - [packages/protocol/templates](packages/protocol/templates)
   - [packages/protocol/schemas](packages/protocol/schemas)
   - [packages/protocol/adapters](packages/protocol/adapters)

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

Current npm entrypoint:

```bash
npx @brawnen/agent-harness-cli init
npx @brawnen/agent-harness-cli init --protocol-only
```

Notes:

- the npm packages are now published
- the recommended npm entrypoint is `npx @brawnen/agent-harness-cli init`
- local usage requires `Node.js >= 18`
- if you only want rules, templates, and schemas, you can install `@brawnen/agent-harness-protocol`

## Use Agent Harness In This Repository

This repository already uses `agent-harness` on itself.

You can use it in this repo right now with:

```bash
codex
node packages/cli/bin/agent-harness.js status
node packages/cli/bin/agent-harness.js delivery ready
```

The current self-hosting setup includes:

- `harness.yaml` as the project policy entrypoint
- `.harness/state`, `.harness/audit`, and `.harness/reports` as runtime directories
- `.codex/config.toml` and `.codex/hooks.json` as the Codex host integration layer
- `delivery commit` as the standard local commit entrypoint

For the full self-hosting and cross-repo usage guide, see:

- [How To Use Agent Harness In This Repository And Other Projects](docs/2026-04-05-agent-harness-usage-guide-v0.1.en.md)

## Quick Start

### Protocol only

1. Copy the rules into `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`
2. Reuse templates and schemas as needed
3. Start using the host with those rules in place

### npm CLI

If you want to use `agent-harness` in an existing project today, the recommended path is npm:

```bash
npx @brawnen/agent-harness-cli init --host codex
npx @brawnen/agent-harness-cli status
```

Or install it into the project first:

```bash
npm install -D @brawnen/agent-harness-cli
npx agent-harness init --host codex
```

### Local CLI

If you want to reuse the development CLI directly from this repository, use the local path:

```bash
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js init --host codex
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js status
```

For the full cross-repo setup guide, see:

- [How To Use Agent Harness In This Repository And Other Projects](docs/2026-04-05-agent-harness-usage-guide-v0.1.en.md)

### Codex

This repository already includes:

- [.codex/config.toml](.codex/config.toml)
- [.codex/hooks.json](.codex/hooks.json)
- [.codex/hooks/user_prompt_submit_intake.js](.codex/hooks/user_prompt_submit_intake.js)
- [.codex/hooks/session_start_restore.js](.codex/hooks/session_start_restore.js)
- [.codex/hooks/pre_tool_use_gate.js](.codex/hooks/pre_tool_use_gate.js)
- [.codex/hooks/post_tool_use_record_evidence.js](.codex/hooks/post_tool_use_record_evidence.js)

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
├── .harness/       # runtime state / audit / reports / tasks
├── packages/
│   ├── protocol/   # rules / schemas / templates / adapters
│   └── cli/        # Node.js CLI
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

- [packages/cli/README.md](packages/cli/README.md)
- [packages/protocol/README.md](packages/protocol/README.md)

## How To Use It In A Project

The recommended adoption path is:

1. Run `npx @brawnen/agent-harness-cli init --host codex` in the target repository
2. Let the CLI generate:
   - `harness.yaml`
   - `.harness/`
   - host rule blocks and hook config
3. Use the day-to-day commands:
   - `agent-harness status`
   - `agent-harness task intake`
   - `agent-harness verify`
   - `agent-harness report`
   - `agent-harness delivery commit`

If you only want the protocol layer without runtime directories:

1. Install or copy `@brawnen/agent-harness-protocol`
2. Place `rules/base.md` or `rules/full.md` into `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`
3. Reuse `templates/` and `schemas/` as needed

## What Is Still Missing Before Broader Open Source Adoption

The project is already ready for individual developers and teams to try in real repositories, and feedback from broader adoption is welcome.

Main remaining work:

- tighter README / Quick Start polish
- more host coverage
  - `Claude Code`
  - `Gemini CLI`
  - `Antigravity`
- stronger CI / release flow
- more host E2E coverage and misclassification fixtures

## Documentation

- [Agent Harness Design v0.3](docs/2026-04-03-agent-harness-design-v0.3.md)
- [Open Source Architecture ADR](docs/2026-04-02-agent-harness-open-source-architecture-adr-v0.1.md)
- [Codex Auto Intake Design](docs/2026-04-03-codex-auto-intake-design-v0.1.md)
- [Codex Hooks Workflow](docs/2026-04-03-codex-hooks-workflow-v0.1.md)
- [Codex v0.3 Roadmap](docs/2026-04-04-codex-v0.3-roadmap.md)
- [CHANGELOG Maintenance Policy](docs/2026-04-04-changelog-maintenance-policy-v0.1.md)
- [Workflow Policy Design v0.1](docs/2026-04-05-workflow-policy-design-v0.1.md)
- [Task Core Misclassification Fixture Workflow](docs/2026-04-03-task-core-misclassification-fixture-workflow-v0.1.md)
- [How To Use Agent Harness In This Repository And Other Projects](docs/2026-04-05-agent-harness-usage-guide-v0.1.en.md)
- [CLI README](packages/cli/README.md)
- [Protocol README](packages/protocol/README.md)
- [CLI README (Chinese)](packages/cli/README.zh-CN.md)
- [Protocol README (Chinese)](packages/protocol/README.zh-CN.md)

Historical drafts and early specifications are archived under [`docs/archive/`](docs/archive).
