# Agent Harness Self-Hosting And Cross-Repo Usage Guide v0.1

[中文](docs/2026-04-05-agent-harness-usage-guide-v0.1.md)

This document answers two questions:

1. How `agent-harness` is used inside the `agent-harness` repository itself
2. How to use `agent-harness` in other local projects on your machine

## 1. How It Is Used In This Repository

This repository is already self-hosting `agent-harness`.

The current setup includes:

- [harness.yaml](harness.yaml): project policy entrypoint
- [.harness/tasks](.harness/tasks): task templates
- [.harness/state](.harness/state): task state
- [.harness/audit](.harness/audit): audit logs
- [.harness/reports](.harness/reports): completion reports
- [.codex/config.toml](.codex/config.toml): Codex feature flag
- [.codex/hooks.json](.codex/hooks.json): Codex hook integration

The minimum path in this repository is:

```bash
codex
node packages/cli/bin/agent-harness.js status
node packages/cli/bin/agent-harness.js delivery ready
```

If you are not relying on automatic Codex hooks, you can still use the CLI manually:

```bash
node packages/cli/bin/agent-harness.js task intake "task description"
node packages/cli/bin/agent-harness.js task confirm
node packages/cli/bin/agent-harness.js verify
node packages/cli/bin/agent-harness.js report --conclusion "summary"
node packages/cli/bin/agent-harness.js delivery commit
```

### 1.1 Interaction Rhythm

For day-to-day team usage, keep the interaction rhythm consistent:

- before confirmation: propose the plan and wait
- after confirmation: execute directly, without repeating the previous full plan
- final close-out: provide the result once, without repeating interim summaries verbatim

This rule is worth keeping in host rule files and project conventions so the agent does not drift into repetitive responses during longer tasks.

## 2. How To Use It In Other Projects

Today there are two realistic adoption modes.

### 2.1 Protocol only

Use this if you:

- want to try the rules first
- do not want to adopt the CLI yet
- are on a host without full hook support

How:

1. Copy [packages/protocol/rules/base.md](packages/protocol/rules/base.md) or [packages/protocol/rules/full.md](packages/protocol/rules/full.md) into the target repo’s `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md`
2. Reuse:
   - [packages/protocol/templates](packages/protocol/templates)
   - [packages/protocol/schemas](packages/protocol/schemas)
   - [packages/protocol/adapters](packages/protocol/adapters)

### 2.2 Install The CLI From npm

This is the recommended path now.

From the target repository:

```bash
npx @brawnen/agent-harness-cli init --host codex
```

Or install it first:

```bash
npm install -D @brawnen/agent-harness-cli
npx agent-harness init --host codex
```

After initialization, the common commands are:

```bash
npx agent-harness status
npx agent-harness task intake "task description"
npx agent-harness verify
npx agent-harness report --conclusion "summary"
npx agent-harness delivery ready
```

If you only want the protocol layer, install:

```bash
npm install -D @brawnen/agent-harness-protocol
```

### 2.3 Reuse The Current Local CLI Directly

If you want to reuse the development CLI directly from this repository, this is still useful for you or your team.

From the target repository:

```bash
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js init --host codex
```

After initialization, the common commands are:

```bash
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js status
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js task intake "task description"
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js verify
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js report --conclusion "summary"
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js delivery ready
```

## 3. Recommended Rollout Order

If you want to roll this out across your local projects, the suggested order is:

1. Start with one frequently used `Codex` repo and adopt the full CLI
2. Let other team repos start with `protocol-only`
3. Standardize on `npx @brawnen/agent-harness-cli init`

## 4. When To Use The Full CLI

Use the full CLI if you want:

- persistent task state
- `verify / report / delivery commit`
- `Codex hooks`
- pre-tool blocking for high-risk writes

Use `protocol-only` if you only want:

- behavior rules first
- no runtime `.harness/` directory yet
- a lower-friction trial in repos without hook support

## 5. Current Boundaries

This guide reflects the current implementation today:

- `Codex` is the most complete host
- `Claude Code`, `Gemini CLI`, and `Antigravity` are still future work
- `commit` is supported as an explicit local delivery step
- `push` remains manual
- npm packages are now available, so cross-repo adoption should prefer the npm CLI path
