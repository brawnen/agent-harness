# @brawnen/agent-harness-protocol

[中文](README.zh-CN.md)

`@brawnen/agent-harness-protocol` contains the protocol-layer assets of `agent-harness`.

It currently includes:

- `rules/` for protocol rules
- `schemas/` for JSON Schema files
- `templates/` for task templates
- `adapters/` for host integration examples and guidance

## Purpose

This package exists so the protocol can be reused independently from the CLI.

That means:

- the protocol must remain usable on its own
- rules must not exist only inside the CLI
- the CLI may depend on `protocol`
- `protocol` must not depend on `cli`

## Current Status

The current repository already places the protocol resources here:

- `schemas/`
- `templates/`
- `rules/base.md`
- `rules/full.md`
- `adapters/` for host-specific notes and example configuration

This package is stable enough to keep publishing as the reusable protocol layer of `Agent Harness Runtime`.
It should remain small, reusable, and maintenance-oriented rather than absorbing higher-level runtime behavior.

## Typical Use

If you only want the behavior contract, without installing the full CLI:

1. Copy `rules/base.md` or `rules/full.md` into `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md`
2. Reuse task templates from `templates/`
3. Reuse schemas from `schemas/`
4. Use `adapters/` as host-specific reference material

## Scope

This package is responsible for:

- protocol rules
- schemas
- task templates
- host adapter examples

This package is not responsible for:

- project initialization
- task state persistence
- audit log writing
- gate execution
- report generation

Those responsibilities belong to `@brawnen/agent-harness-cli`.
