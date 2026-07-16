---
name: git
description: Adrien's git and commit conventions — Conventional Commits, English, no AI trailer.
triggers: [git, commit, branch, pull request, "PR", changelog, .gitmessage]
scope: conventions
version: 1.3.0
last_verified: "2026-05-30"
status: reviewed
lang: en
sources:
  - { type: artefact, ref: "auto-admin/.gitmessage", date: "2026-05-29", confidence: extracted }
  - { type: artefact, ref: "aira-compact-learning-hub/CLAUDE.md", date: "2026-05-29", confidence: extracted }
  - { type: matrix, ref: "workflow.rank.agent_autonomy", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "git.single.branch_strategy", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "git.open.commit_granularity", date: "2026-05-29", confidence: stated }
  - { type: research, ref: "code.claude.com", date: "2026-05-30", confidence: external }
  - { type: matrix, ref: "cloud.deploy.branch_gating", date: "2026-05-30", confidence: stated }
---

# Git & commit conventions

Commits follow **Conventional Commits**: `type(scope): subject`, imperative mood,
English, subject ≤ ~72 chars.
<!-- source: artefact:auto-admin/.gitmessage / 2026-05-29 / confidence:extracted -->

Types in use: `feat fix docs refactor chore test style perf ci build`. Scope is
optional and names the area touched (e.g. `matrix`, `scripts`, `conventions`).
<!-- source: artefact:aira-compact-learning-hub/CLAUDE.md / 2026-05-29 / confidence:extracted -->

**Never** add a `Co-Authored-By` trailer, and **never** mention an AI / agent /
assistant in a commit message. This is absolute, and it overrides any default an
agent may carry. (Corroborated across the sibling projects' CLAUDE.md/README files.)
<!-- source: artefact:auto-admin/.gitmessage / 2026-05-29 / confidence:extracted -->

Commit in small, regular, logically-scoped chunks — one coherent change per commit.
<!-- source: artefact:aira-compact-learning-hub/CLAUDE.md / 2026-05-29 / confidence:extracted -->

Work local-first: commit to `main`, and push only when explicitly asked.
<!-- source: artefact:aira-compact-learning-hub/CLAUDE.md / 2026-05-29 / confidence:extracted -->

**Agent autonomy boundary:** an agent may **commit** autonomously to the local
branch, but **pushing and deploying still require explicit approval** — the broad
agent-autonomy preference is bounded here for blast radius.
<!-- source: matrix:workflow.rank.agent_autonomy / 2026-05-29 / confidence:stated -->

**One commit** is a few modifications that form a logical unit — something easily
described by a single sentence plus a scope.
<!-- source: matrix:git.open.commit_granularity / 2026-05-29 / confidence:stated -->

**Branching:** mostly trunk-based with solid CI, plus GitHub flow when useful. The
adaptable, **Claude-Code-optimized** workflow he wanted is the git-worktree flow below.
<!-- source: matrix:git.single.branch_strategy / 2026-05-29 / confidence:stated -->

**Deploy branches (current default):** while on the Vercel free plan, `main` and
feature branches don't deploy — production and preview ship via the `deploy-prod`
and `deploy-preview` branches. See cloud for the mechanism; revert when
off the free plan.
<!-- source: matrix:cloud.deploy.branch_gating / 2026-05-30 / confidence:stated -->

## Worktree workflow (Claude Code)

Adopted from research (official Claude Code docs):

Run isolated parallel sessions with `claude --worktree <name>` (`-w`) — a worktree
under `.claude/worktrees/<name>/` on branch `worktree-<name>`. A second name in
another terminal gives a file-isolated parallel session; mid-session, ask to "work
in a worktree" (`EnterWorktree`). Add `.claude/worktrees/` to `.gitignore`.
<!-- source: research:code.claude.com / 2026-05-30 / confidence:external -->

Put a **`.worktreeinclude`** (gitignore syntax) at the repo root to auto-copy
gitignored files (`.env`, secrets) into each new worktree — pairs with the staged
`.env` secrets convention.
<!-- source: research:code.claude.com / 2026-05-30 / confidence:external -->

Worktrees branch from `origin/HEAD` by default; `worktree.baseRef: "head"` carries
WIP, and `claude --worktree "#1234"` builds one from a PR. Subagents can isolate too
via `isolation: worktree` in their frontmatter.
<!-- source: research:code.claude.com / 2026-05-30 / confidence:external -->

**Gotcha:** each worktree is a separate checkout — run `pnpm install` per worktree
(node_modules isn't shared) for the Nx/pnpm stack. Clean sessions auto-clean; dirty
ones prompt.
<!-- source: research:code.claude.com / 2026-05-30 / confidence:external -->

## Setup

```bash
git config commit.template .gitmessage
```

## Related

- [tooling conventions](tooling.md) — pre-commit, ruff.
- [prose conventions](prose.md) — the append-only `log.md` format.
