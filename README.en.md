# agent-harness

[中文](README.md)

`agent-harness` is a protocol and toolchain for AI coding agent hosts such as `Codex`, `Claude Code`, and `Gemini CLI`.
The current product direction is explicit: move the runtime center into agent/host hooks, and reduce the CLI to a bootstrap, diagnostics, and manual-fallback compatibility layer.
This repository is now in maintenance mode: it remains usable and publishable, but it is no longer where the next-generation harness direction will be developed.

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

### 2. Protocol + repo-local hooks + compatibility CLI

Use this if you want:

- persistent task state
- pre-tool gating and audit logs
- a real delivery close-out path
- a compatibility CLI for setup and fallback, not a long-term product center

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
- treat the CLI as a bootstrap / status / fallback entrypoint instead of the core runtime
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
- `.harness/hosts/*` as the repo-local hook runtime source
- `packages/cli` as the compatibility CLI
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
- [Agent Harness Runtime Team Trial Checklist](docs/2026-04-10-runtime-team-trial-checklist-v0.1.md)
- [Agent Harness Runtime Stability Surface And Frozen Scope](docs/2026-04-10-runtime-stability-surface-and-frozen-scope-v0.1.md)

## In This Repository

This repository self-hosts `agent-harness` and is maintained as the reference `Agent Harness Runtime` implementation.

The key point is not "how to run the CLI", but how the repository is actually wired today:

- `harness.yaml` is the policy entry
- `.harness/hosts/*` and `.harness/rules/*` are the source of truth for host scripts and rules
- `.codex/.claude/.gemini` are thin host-discovery shells
- `packages/cli` is now the compatibility CLI for `init / sync / status / verify / report / delivery`
- repo-local hooks now consume the stable runtime entry `@brawnen/agent-harness-cli/runtime-host`

The most common commands in this repository are:

```bash
codex
node packages/cli/bin/agent-harness.js status
node packages/cli/bin/agent-harness.js sync --check
npm run runtime:p0:check
npm run runtime:p1:check
node packages/cli/bin/agent-harness.js delivery ready
```

What they are for:

- `codex`: enter the default host with repo-local Codex hooks enabled
- `status`: inspect host integration, runtime directories, and delivery gates
- `sync --check`: confirm the repository still matches the reference host layout with no source/generated drift
- `runtime:p0:check`: run the minimum `task-core + host-hooks + init/status` regression suite
- `runtime:p1:check`: add compatibility regression for `sync/status`
- `delivery ready` / `delivery commit`: check and execute local commit flow after `verify/report` are complete

Current host status in this repository:

- `Codex`: `SessionStart / UserPromptSubmit` enabled by default; tool-level hooks stay off to avoid foreground noise
- `Claude Code`: `SessionStart / UserPromptSubmit / PreToolUse / PostToolUse / Stop` wired
- `Gemini CLI`: `SessionStart / BeforeAgent / BeforeTool / AfterTool / AfterAgent` wired

### Codex

This repository already includes:

- [.codex/config.toml](.codex/config.toml)
- [.codex/hooks.json](.codex/hooks.json)
- [.harness/hosts/codex/hooks/user_prompt_submit_intake.js](.harness/hosts/codex/hooks/user_prompt_submit_intake.js)
- [.harness/hosts/codex/hooks/session_start_restore.js](.harness/hosts/codex/hooks/session_start_restore.js)
- [.harness/hosts/codex/hooks/pre_tool_use_gate.js](.harness/hosts/codex/hooks/pre_tool_use_gate.js)
- [.harness/hosts/codex/hooks/post_tool_use_record_evidence.js](.harness/hosts/codex/hooks/post_tool_use_record_evidence.js)

Where:

- root `.codex/` is only the host-discovery shell
- the actual hook implementation lives under `.harness/hosts/codex/`

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

Currently disabled by default:

- `PreToolUse` for `gate before-tool`
- `PostToolUse` for automatic evidence capture

Reason:

- current Codex hook lifecycle visibility still creates too much user-facing noise for tool-level hooks
- the repository keeps those hooks implemented, but does not enable them by default in `.codex/hooks.json`

## Current Status

`Runtime closeout` for `P0 / P1` is now complete.

This means the project is no longer trying to grow the CLI as the product center. It is now a closed-out, maintenance-mode `Agent Harness Runtime`:

- the formal product shape is now `Agent Harness Runtime`
- the CLI is explicitly narrowed to a compatibility layer
- this repository is maintained as the reference Runtime implementation
- repo-local hooks are now the primary host integration path
- repo-local hooks consume the stable runtime entry `@brawnen/agent-harness-cli/runtime-host`
- the repository now accepts only necessary bug fixes, compatibility fixes, documentation clarification, and release maintenance
- the next-generation harness direction will not continue inside this repository

Current host status:

- `Codex`: `SessionStart / UserPromptSubmit` enabled by default; `PreToolUse / PostToolUse` remain off by default because of foreground hook noise
- `Claude Code`: `SessionStart / UserPromptSubmit / PreToolUse / PostToolUse / Stop` wired
- `Gemini CLI`: `SessionStart / BeforeAgent / BeforeTool / AfterTool / AfterAgent` wired

Current stable surface:

- core commands: `init / sync / status / verify / report / delivery`
- runtime source directories: `.harness/hosts/*`, `.harness/rules/*`
- this repository should keep `sync --check` converged
- after key changes, the baseline checks are:
  - `npm run runtime:p0:check`
  - `npm run runtime:p1:check`

The current minimum usable loop includes:

- `task intake / confirm / suspend-active`
- `state`
- `verify`
- `report`
- `delivery ready / request / commit`
- `docs scaffold`
- the minimum hook loop for all three hosts
- `status` recognition for both repo-local and legacy host entrypoints
- `sync` convergence checks for the reference layout

Current boundaries:

- the CLI is no longer expanding into a larger product center
- `push` remains manual, not automated
- legacy CLI hook commands are still recognized for compatibility, but new setup should default to repo-local hooks
- `runtime-host` still lives inside the CLI package, not a separate runtime package yet
- org-level policy, approval, insights, and console capabilities belong to the later `Control Plane`

In practice, this repository should now be understood as:

- a usable repo-local agent runtime
- a reference implementation for small-team adoption
- a first-generation product in maintenance mode, not an actively expanding product center

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
  - `Antigravity`
- higher-level parity between `Gemini CLI`, `Claude Code`, and `Codex`
- stronger CI / release flow
- more host E2E coverage and misclassification fixtures

## Documentation

- [Agent Harness Design v0.3](docs/2026-04-03-agent-harness-design-v0.3.md)
- [Open Source Architecture ADR](docs/2026-04-02-agent-harness-open-source-architecture-adr-v0.1.md)
- [Codex Auto Intake Design](docs/2026-04-03-codex-auto-intake-design-v0.1.md)
- [Codex Hooks Workflow](docs/2026-04-03-codex-hooks-workflow-v0.1.md)
- [CLI Closure And Agent-Native Runtime Transition Plan](docs/2026-04-10-cli-closure-agent-native-transition-plan-v0.1.md)
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
