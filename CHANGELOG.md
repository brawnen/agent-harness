# Changelog

All notable changes to `agent-harness` will be documented in this file.

## Unreleased

### 2026-04-05

- Added Codex `PreToolUse` gating so write tools are checked by `gate before-tool` before execution.
- Made `gate` consume `harness.yaml risk_rules.path_matches` to derive path-based high-risk writes and require confirmation.

### 2026-04-04

- Established the `v0.3` design and config baseline for the Node.js CLI, Codex hooks, and output policy.
- Added Codex hook workflow stabilization and a minimal Codex E2E regression script.
- Enabled repository-level `output_policy` requirements for `report`, `changelog`, `design_note`, and `adr`.
- Added `docs scaffold` for `design-note` and `adr`, and surfaced active-task artifact hints in `status`.
- Tightened `delivery commit` with wide-scope blocking, `--dry-run`, and explicit `--force-wide-scope`.
