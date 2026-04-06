# Changelog

All notable changes to `agent-harness` will be documented in this file.

## Unreleased

- Upgraded Claude Code host integration from the old PreToolUse/PostToolUse-only loop to a five-hook chain with `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop`, added a new CLI hook entrypoint for Claude hooks, taught `status` to distinguish legacy vs full Claude hook setups, updated the repository’s `.claude/settings.json`, and aligned current docs with the new Claude capability boundary.
- Implemented the minimal Gemini CLI host integration closeout by aligning the Gemini adapter docs with the real L2 support boundary, teaching `status` to report a Gemini-specific adapter summary, updating the repository `GEMINI.md` and project collaboration preferences, and removing outdated README / usage-guide wording that still treated Gemini CLI as future work.
- Tightened Claude Code host integration by making `init --host claude-code` generate `npx @brawnen/agent-harness-cli` hook commands, updating `status` to recognize the new command shape, aligning README / usage guide / adapter docs with the current Claude Code support boundary, and adding a project-level default collaboration preference for Claude Code host integration tasks in `AGENTS.md`.
- Reduced custom Codex hook status noise by removing repo-local `statusMessage` fields while keeping all four core hooks enabled, made `writeContinue()` return an empty object on continue paths, added a read-only Bash fast path in `PreToolUse`, and documented the control-plane visibility policy for hooks.

## 0.1.0 - 2026-04-06

### 2026-04-05

- Finalized npm release preparation by adding MIT license metadata and package-level LICENSE files, making package README strategy English-first for npm, wiring `@brawnen/agent-harness-cli` to depend explicitly on `@brawnen/agent-harness-protocol`, and cleaning repository text to avoid exposing the original personal name.
- Moved `workflow_policy` from `recommend` to `warn` so full-workflow tasks now emit explicit warnings in `status`, `report`, and `delivery` without becoming hard-blocking.
- Added the interaction rhythm rule to protocol rules and documentation: plan before confirmation, execute after confirmation, and avoid repeating the same summary twice.
- Added the first `workflow_policy` implementation so tasks can be auto-classified into `full` or `lite`, upgraded from `lite` to `full`, and surfaced in `status`, `report`, and `delivery`.
- Removed the old tracked `harness/reports/*.json` files that remained after migrating runtime data to `.harness/`.
- Migrated the default runtime directory from `harness/` to `.harness/`, kept legacy read compatibility in the CLI, and switched the repository itself to `.harness/`.
- Removed the old root-level doc paths after moving early drafts and specs into `docs/archive/`, so the archive migration no longer leaves duplicate file history in the top-level `docs/` directory.
- Cleaned `harness/` by removing unused `examples`, `templates`, and duplicated `schemas` assets, and updated `harness.yaml` to stop referencing removed Ruby-based commands and stale design paths.
- Archived early design and integration drafts under `docs/archive/` and kept only the current documentation baseline in `docs/`.
- Added Codex `PreToolUse` gating so write tools are checked by `gate before-tool` before execution.
- Made `gate` consume `harness.yaml risk_rules.path_matches` to derive path-based high-risk writes and require confirmation.
- Expanded Codex `PreToolUse` Bash path extraction to cover heredoc and common file-writing commands such as `tee`, `install`, `dd`, `rsync`, `chmod`, and `truncate`.
- Documented the current high-confidence Bash command patterns handled by `PreToolUse` in the CLI README.
- Added task-level `commit_exists` detection so `delivery ready` can infer whether task-related files have already been committed.
- Rewrote the repository homepage README for open-source onboarding and added an English README entrypoint.
- Added English README entrypoints for `packages/cli` and `packages/protocol`.

### 2026-04-04

- Established the `v0.3` design and config baseline for the Node.js CLI, Codex hooks, and output policy.
- Added Codex hook workflow stabilization and a minimal Codex E2E regression script.
- Enabled repository-level `output_policy` requirements for `report`, `changelog`, `design_note`, and `adr`.
- Added `docs scaffold` for `design-note` and `adr`, and surfaced active-task artifact hints in `status`.
- Tightened `delivery commit` with wide-scope blocking, `--dry-run`, and explicit `--force-wide-scope`.
