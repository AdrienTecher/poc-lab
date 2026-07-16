---
name: prose
description: Adrien's writing register and documentation structure — dense, LLM-Wiki, bilingual.
triggers: [docs, markdown, writing, README, CLAUDE.md, prose, documentation]
scope: conventions
version: 1.0.0
last_verified: "2026-05-29"
status: reviewed
lang: en
sources:
  - { type: artefact, ref: "auto-admin/CLAUDE.md", date: "2026-05-29", confidence: extracted }
  - { type: artefact, ref: "aira-compact-learning-hub/CLAUDE.md", date: "2026-05-29", confidence: extracted }
  - { type: artefact, ref: "local-network/CLAUDE.md", date: "2026-05-29", confidence: extracted }
---

# Prose & documentation register

The canonical knowledge structure is the **Karpathy "LLM Wiki" pattern**: raw,
immutable `sources/` → a synthesized `wiki/` that is the source of truth →
derived outputs. Never hand-edit a derived artifact; edit the source and re-derive.
<!-- source: artefact:auto-admin/CLAUDE.md / 2026-05-29 / confidence:extracted -->

Documents addressed to an agent are written as a **numbered operating manual** —
a problem statement, then the layered model in a table, then the rules.
<!-- source: artefact:aira-compact-learning-hub/CLAUDE.md / 2026-05-29 / confidence:extracted -->

Speak **directly to the LLM**: "the human curates and directs; you do the
bookkeeping." Prose is dense and architecture-first — no bullet-padding.
<!-- source: artefact:auto-admin/CLAUDE.md / 2026-05-29 / confidence:extracted -->

Keep an **append-only log**, newest first, with a greppable prefix:
`## [YYYY-MM-DD] <type> | <summary>`.
<!-- source: artefact:local-network/CLAUDE.md / 2026-05-29 / confidence:extracted -->

Every tree carries a **master `index.md`** — one line per page with a summary.
<!-- source: artefact:aira-compact-learning-hub/CLAUDE.md / 2026-05-29 / confidence:extracted -->

Cross-link densely with **relative links**; broken links are a lint error.
<!-- source: artefact:auto-admin/CLAUDE.md / 2026-05-29 / confidence:extracted -->

**Bilingual policy:** English internally (code, wiki, commits, docs); the native
language (French) for outward-facing artifacts, each carrying an English summary.
<!-- source: artefact:auto-admin/CLAUDE.md / 2026-05-29 / confidence:extracted -->

**Redaction:** never copy raw PII; link to the source, and mask if unavoidable
(`IBAN ••••1234`).
<!-- source: artefact:auto-admin/CLAUDE.md / 2026-05-29 / confidence:extracted -->

## Related

- knowledge-provenance — the frontmatter + citation precedent.
- llm-wiki — the ingest/query/lint operations.
