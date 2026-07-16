---
name: visual-taste
description: Adrien's visual/UX taste — rich in craft, minimalist in presentation; headless+Tailwind; motion as delight.
triggers: [design, ui, ux, visual, aesthetics, tailwind, motion, accessibility, layout]
scope: design
version: 1.0.0
last_verified: "2026-05-29"
status: reviewed
lang: en
sources:
  - { type: matrix, ref: "design.pairwise.minimal_vs_rich", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "design.single.design_system", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "design.pairwise.motion_stance", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "design.rank.ui_priorities", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "design.scenario.first_ui_pass", date: "2026-05-29", confidence: stated }
  - { type: matrix, ref: "design.open.accessibility_bar", date: "2026-05-29", confidence: stated }
related: [claude-products]
---

# Visual & UX taste

The defining tension to get right: **rich and expressive in craft, but minimalist
and uncluttered in presentation.** "Rich" means depth and polish, never clutter.
<!-- source: matrix:design.pairwise.minimal_vs_rich / 2026-05-29 / confidence:stated -->

**Information hygiene is the baseline** (his framing of "accessibility"): no visual
pollution — no gratuitous emojis, no generic-looking or redundant information, no
disorganized elements. Each item is carefully crafted; everything is a few clicks
away; the user should spend little time finding anything.
<!-- source: matrix:design.open.accessibility_bar / 2026-05-29 / confidence:stated -->

**Top priorities: consistency and aesthetics** — a coherent system that also looks
good.
<!-- source: matrix:design.rank.ui_priorities / 2026-05-29 / confidence:stated -->

**Component approach: headless primitives + Tailwind** (unstyled behaviour, styled
to taste) — consistent with the Tailwind 4 stack.
<!-- source: matrix:design.single.design_system / 2026-05-29 / confidence:stated -->

**Motion is polish** — use it expressively to delight, not only to signal state.
<!-- source: matrix:design.pairwise.motion_stance / 2026-05-29 / confidence:stated -->

**First UI pass: nail the core feature** so it captures the spirit of the design
system; let the rest follow from that anchor.
<!-- source: matrix:design.scenario.first_ui_pass / 2026-05-29 / confidence:stated -->

> Agents take note: Adrien's most common Claude Code friction is UI that lacks
> design ambition and polish (see claude-products).
> Aim above the bland default — expressive craft, zero clutter, no emoji padding.

## Related

- claude-products — where the design-ambition friction is recorded.
