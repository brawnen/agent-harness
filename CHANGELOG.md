# Changelog

All notable changes to `agent-harness` will be documented in this file.

## Unreleased

### 2026-04-05

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
