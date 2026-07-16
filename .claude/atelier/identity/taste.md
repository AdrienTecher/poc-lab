---
name: taste
description: Adrien's code- and decision-level taste — concise idiom, explicit errors, structure-first, map-before-touch.
triggers: [taste, code style, decisions, abstraction, error handling, review, aesthetic]
scope: identity
version: 1.0.0
last_verified: "2026-05-29"
status: reviewed
lang: en
sources:
  - { type: matrix, ref: "taste.pairwise.explicit_vs_concise", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "taste.pairwise.comments_vs_naming", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "taste.pairwise.abstraction_timing", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "taste.pairwise.errors_throw_vs_result", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "taste.pairwise.config_vs_convention", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "taste.rank.code_review_focus", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "taste.scenario.inherit_messy_codebase", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "taste.scenario.over_engineered_pr", date: "2026-05-29", confidence: stated }
related: [persona]
---

# Taste

**Concise over explicit** for idiomatic constructions — he reaches for
`[...Array(n).keys()]` over the longhand `Array.from({length:n}, …)`.
<!-- source: matrix:taste.pairwise.explicit_vs_concise / 2026-05-29 / confidence:stated -->

**Names and comments, deliberately split:** names carry the *what*; comments carry
the *why* and the non-obvious.
<!-- source: matrix:taste.pairwise.comments_vs_naming / 2026-05-29 / confidence:stated -->

**Abstraction is timed by coupling, not a counter** — he abstracts based on the
coupling and stability of the duplicated thing, not on a fixed "2nd vs 3rd repeat".
<!-- source: matrix:taste.pairwise.abstraction_timing / 2026-05-29 / confidence:stated -->

**Explicit errors over exceptions** — he prefers result-style/explicit returns that
make failure visible in the signature.
<!-- source: matrix:taste.pairwise.errors_throw_vs_result / 2026-05-29 / confidence:stated -->

**Explicit configuration over convention** — make behaviour visible and declared,
even at some verbosity, rather than relying on implicit defaults.
<!-- source: matrix:taste.pairwise.config_vs_convention / 2026-05-29 / confidence:stated -->

In review he scans **structure first** — architecture, boundaries, where the logic
lives — before naming or surface style.
<!-- source: matrix:taste.rank.code_review_focus / 2026-05-29 / confidence:stated -->

Handed a messy, inconsistent codebase, his first move is to **map it out on paper**
— understand the system before touching it.
<!-- source: matrix:taste.scenario.inherit_messy_codebase / 2026-05-29 / confidence:stated -->

Faced with a clever-but-over-abstracted PR, he **asks the author questions** and
together they decide whether it should be commented or simplified — Socratic, not
prescriptive.
<!-- source: matrix:taste.scenario.over_engineered_pr / 2026-05-29 / confidence:stated -->

## Related

- [persona](persona.md) — the background and decision style behind this taste.
