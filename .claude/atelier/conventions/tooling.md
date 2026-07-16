---
name: tooling
description: Adrien's tooling — pnpm@9.9.0, Nx 22, Vitest/Playwright, uv+ruff+pre-commit via uvx.
triggers: [pnpm, nx, vitest, pre-commit, ruff, uv, package manager, monorepo, task runner]
scope: conventions
version: 1.1.0
last_verified: "2026-05-29"
status: reviewed
lang: en
sources:
  - { type: artefact, ref: "devenir-parents/package.json", date: "2026-05-29", confidence: extracted }
  - { type: artefact, ref: "aira-compact-learning-hub/nx.json", date: "2026-05-29", confidence: extracted }
  - { type: artefact, ref: "auto-admin/.pre-commit-config.yaml", date: "2026-05-29", confidence: extracted }
  - { type: artefact, ref: "auto-admin/CLAUDE.md", date: "2026-05-29", confidence: extracted }
  - { type: matrix, ref: "tooling.single.task_runner", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "tooling.scenario.new_repo_setup", date: "2026-05-29", confidence: stated }
---

# Tooling conventions

**JS package manager: pnpm**, pinned via the `packageManager` field at `pnpm@9.9.0`.
<!-- source: artefact:devenir-parents/package.json / 2026-05-29 / confidence:extracted -->

Monorepos use **Nx** (`nx 22.7.3` in aira) with cacheable targets and a custom
named input so editing the knowledge base busts the build/test cache.
<!-- source: artefact:aira-compact-learning-hub/nx.json / 2026-05-29 / confidence:extracted -->

**Python tooling runs through `uv` / `uvx`** — `uvx ruff`, `uvx pre-commit install`
— with no global installs.
<!-- source: artefact:auto-admin/CLAUDE.md / 2026-05-29 / confidence:extracted -->

**pre-commit pins:** `pre-commit-hooks v6.0.0`, `ruff-pre-commit v0.15.14`.
<!-- source: artefact:auto-admin/.pre-commit-config.yaml / 2026-05-29 / confidence:extracted -->

Every knowledge repo ships a **custom lint script** that exits non-zero on error
(CI-friendly) — the "linter-as-tool" pattern.
<!-- source: artefact:auto-admin/CLAUDE.md / 2026-05-29 / confidence:extracted -->

> Test tooling observed: Vitest (aira) and Playwright (devenir).

Default **task runner: Nx**, across his monorepos.
<!-- source: matrix:tooling.single.task_runner / 2026-05-29 / confidence:stated -->

A new repo starts **docs-first** — a plan, guidelines, and stack indications go in
before any code.
<!-- source: matrix:tooling.scenario.new_repo_setup / 2026-05-29 / confidence:stated -->

## Related

- python — the ruff config these hooks enforce.
- [git](git.md) — commit conventions and the `.gitmessage` template.
