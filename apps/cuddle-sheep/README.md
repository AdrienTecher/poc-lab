# Nuage — le mouton à câliner

A sheep you look after, and the puzzles that caring for him opens. Buildable app:
`index.html` is a shell, everything else lives under `src/`.

```bash
pnpm --filter @poc-lab/cuddle-sheep dev     # vite dev server
pnpm build                                  # from the repo root, into dist/cuddle-sheep/
```

## Layout

Plain ES modules, no framework. `main.js` decides nothing: it builds the world
in the one order that matters — the meadow is an SVG, so DOM order *is* paint
order — and runs the single frame loop.

| tree | what lives there |
|---|---|
| `engine/` | reusable and world-agnostic: springs, particles, the synth, the 2:1 iso kit, painter order, the save file |
| `world/` | what he *is*: the rig, the mood, the fleece, the clover patch, your hands, the progression |
| `places/` | where he *goes*: one diorama per module, exactly one mounted at a time |
| `puzzles/` | the rules of a place, as pure functions of where the pieces are |
| `ui/` | the chrome around the scene: the two clock rings, the hint bubble, the live region |

Two rules keep it from tangling. **Painter order is computed, not hand-wired** —
he is a DOM actor between two SVG layers, and every piece declares its own depth
(`engine/depth.js`). **The progression is a store, not a call** — the clover
patch and the four-leaf sprout both watch `world/valley.js`, so neither has to
be known by whatever changed it.

## The two clocks

Both are a single stored epoch, derived on read, so they keep running while the
tab is closed and need no ticking:

| clock | field | rule |
|---|---|---|
| happiness | `sheep.happyUntil` | a full cuddle buys exactly 5 min, drooping over the last 20 s |
| fleece | `sheep.woolFrom` | shorn → full in 15 min; the shears refuse a sheep who is not settled |

Both live in one versioned save under `nuage:save`, owned by
[`src/engine/save.js`](src/engine/save.js) — the only module that knows the
shape. It migrates the five loose v1 keys on first boot and clears them, and
anything it cannot read opens a fresh meadow rather than a broken one.

**Wool is a body state, mood is a feeling state.** Nothing outside the mood
system may write the happiness window — not the fleece, not the crossing.

## Tests

```bash
pnpm build && node apps/cuddle-sheep/tests/run.mjs        # all specs
node apps/cuddle-sheep/tests/run.mjs geometry             # one spec
```

They drive the **built** artifact over HTTP at the real `/poc-lab/cuddle-sheep/`
base, because that is what ships. Playwright is deliberately *not* a dependency
of this package — it would make every CI deploy download a browser it never
uses. Install it where you run the tests (`pnpm add -Dw playwright`) and set
`CHROMIUM=/path/to/chrome` if it cannot find a binary.

| spec | what it protects |
|---|---|
| `geometry` | ten viewports × two modes: no sideways scroll, nothing overflowing, the sheep never cut off, chrome never overlapping |
| `interactions` | every verb, the shearing gate, hit-testing where things look clickable, and that nothing invisible is tabbable |
| `puzzles` | the optimal solution wins, both illegal pairs are caught, and a mistake is always a rewind — never a loss |
| `save` | the clocks survive a reload and never rewind; a corrupt save still opens onto a meadow |
