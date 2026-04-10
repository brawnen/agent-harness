# @brawnen/agent-harness-cli

[中文](README.zh-CN.md)

`@brawnen/agent-harness-cli` is the compatibility CLI for `agent-harness`.

Its focus is no longer to be the long-term product center. It is the compatibility layer for:

- initialization
- host/runtime bootstrap
- status inspection
- manual fallback commands
- task state
- verification
- reports
- gating
- audit
- delivery
- documentation scaffolding

The repo-local host runtime is becoming the primary execution surface. The CLI remains for initialization, diagnostics, and explicit manual operations.

## Current Coverage

The CLI currently includes these commands:

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

The current implementation also covers:

- `--dry-run`
- `--protocol-only`
- host rule injection
- base project config generation
- minimal `.codex/hooks.json` integration
- `.claude/settings.json` hook integration
- `.gemini/settings.json` hook integration

## Current Boundaries

The CLI is already usable, but it is still an evolving implementation.

It currently does not try to provide:

- a fully general host integration layer for every host
- a full shell parser for `Bash`
- automatic `git push`
- a deep upgrader / migration system

## What The CLI Does Today

### `init`

Current responsibilities:

- detect project type
- detect host type
- generate `harness.yaml`
- copy task templates into `.harness/tasks/`
- inject rule blocks into `CLAUDE.md`, `AGENTS.md`, or `GEMINI.md`
- create minimal runtime directories when not using `--protocol-only`

### `task`

Current responsibilities:

- `task intake`
- `task confirm`
- `task suspend-active`
- create a minimal task draft from natural language
- close that draft into a confirmed contract
- provide reusable intake/suspend logic for Codex hooks

### `state`

Current responsibilities:

- `state init`
- `state get`
- `state update`
- `state active`
- maintain `.harness/state/index.json`
- maintain `.harness/state/tasks/<task_id>.json`

### `verify`

Current responsibilities:

- read the active task or an explicit `--task-id`
- evaluate minimal completion requirements
- return structured JSON
- distinguish allow vs block via exit code

### `report`

Current responsibilities:

- reuse `verify` before report generation
- write `.harness/reports/<task_id>.json`
- move the task to `close / done`
- validate required output artifacts such as `CHANGELOG.md`, `design note`, and `ADR`
- compute `delivery_readiness`

### `gate`

Current responsibilities:

- `gate before-tool`
- deterministic checks for write state legality
- `protected_paths`
- path-like scope boundaries
- high-risk confirmation requirements

### `audit`

Current responsibilities:

- `audit append`
- `audit read`
- write `.harness/audit/<task_id>.jsonl`
- record minimal `gate_violation`
- expose `force_override` and `manual_confirmation`

### `delivery`

Current responsibilities:

- `delivery ready`
- `delivery request --action commit|push`
- `delivery commit`
- explicit local commit flow

Current delivery boundary:

- `commit` is supported as an explicit action
- `push` remains manual

### `docs`

Current responsibilities:

- `docs scaffold --type design-note|adr`
- generate minimal Markdown skeletons from task context

## Host Support

The current repository has the most complete host integration for `Codex`.

Current Codex coverage includes:

- `SessionStart`
- `UserPromptSubmit`

Currently disabled by default:

- `PreToolUse`
- `PostToolUse`

Highlights:

- automatic intake / continue / clarify
- active task restore

Current Codex boundary:

- tool-level hooks remain implemented but are not enabled by default because of host visibility noise

Current Gemini CLI coverage includes:

- `SessionStart`
- `BeforeAgent`
- `BeforeTool`
- `AfterTool`
- `AfterAgent`

Highlights:

- automatic intake / continue / clarify
- before-tool gating for supported Gemini tools
- shell evidence capture through `AfterTool`
- completion gating through `AfterAgent`

Current Claude Code coverage includes:

- `SessionStart`
- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `Stop`

### Current `PreToolUse` Coverage For `Bash`

`Bash` currently supports high-confidence path inference for common write commands such as:

- `echo ... > file`
- `cat <<EOF > file`
- `tee file`
- `printf ... | tee file`
- `mkdir -p dir`
- `touch file`
- `sed -i file`
- `perl -pi file`
- `chmod/chown/chgrp target`
- `rm file`
- `truncate -s ... file`
- `dd ... of=file`
- `mv src dst`
- `cp src dst`
- `install -d dir`
- `install -D/-m ... dst`
- `install -Dm644 src dst`
- `install src dst`
- `ln -s src dst`
- `rsync ... dst`

If the target path cannot be inferred with high confidence, the CLI degrades conservatively and only applies state-level gating.

## Validation Helpers

Useful local checks:

```bash
npm --prefix packages/cli run verify:task-core
npm --prefix packages/cli run verify:codex-e2e
npm --prefix packages/cli run verify:host-hooks
npm --prefix packages/cli run verify:init-status
```

From the repository root:

```bash
npm run codex:hooks:check
npm run codex:e2e
npm run runtime:host-hooks
npm run runtime:init-status
npm run runtime:p1:check
node packages/cli/bin/agent-harness.js sync --check
```

`codex:hooks:check` validates the source-of-truth hook files under `.harness/hosts/codex/hooks/`, not the generated root `.codex/` shell.

## Local Invocation Note

If your current working directory is not the repository root, prefer calling the CLI with an absolute path, for example:

```bash
node /abs/path/to/agent-harness/packages/cli/bin/agent-harness.js status
```

Do not assume `node packages/cli/bin/agent-harness.js ...` will work from an arbitrary temporary directory.

## Design Constraint

- the CLI depends on `@brawnen/agent-harness-protocol`
- installing `@brawnen/agent-harness-cli` from npm should automatically pull `@brawnen/agent-harness-protocol`
- the protocol must not depend on the CLI
- the default npm entrypoint is `npx @brawnen/agent-harness-cli init`
- this repository now treats the Node.js CLI as the compatibility layer of `Agent Harness Runtime`
- repo-local hooks should now consume the stable runtime entry `@brawnen/agent-harness-cli/runtime-host`
