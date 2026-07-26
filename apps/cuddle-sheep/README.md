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

## The valley

Four places on one filmstrip, each a frame of the shared coordinate space. The
camera is the viewBox min-x those frames share, so panning is a spring on one
scalar and Nuage's screen position is derived from that same number.

| place | road | the puzzle | what opens it |
|---|---|---|---|
| `la rivière` | 0 | wolf, sheep and cabbage — he is the piece | five clovers eaten |
| `la grange` | 1 | hay-bale Hanoi — the bales ARE the fleeces, he is the crane | three fleeces shorn |
| `le pont` | 2 | bridge-and-lantern — two at a time, at the slower one's pace | la rivière solved |
| `le clocher` | 3 | a phrase of five bells, given back | la grange solved |
| `la clôture` | 4 | lights-out reversed — light all seven, a post wakes its neighbours | le pont solved |
| `la lisière` | 5 | gather three hens where the dog can watch them | le clocher solved |

Only the first two have a door in the meadow, because the meadow has exactly two
care rituals and both are spent. The rest open onto the **borders of the frame** —
the way out of a place is its own edge, as in Dofus: a chevron west, a chevron
east, and one pointing home. So a place further down the road costs *less* than the
second one did, not more.

The valley is **walked**, one screen at a time: from la rivière, le pont is two
hops east. Adjacency is not strict, though — the branches open roads 0-2-4 and
1-3-5, so an edge means "the nearest open place this way" rather than "the next
frame", or a player who only ever feeds him would be walled in at the river. Two branches of three: feeding leads to the river, the
bridge and the fence; shearing leads to the barn, the bells and the wood's edge.

**Adding one costs:** a module in `places/`, a pure ruleset in `puzzles/`, a
palette block, a `.place-ui` bar plus its one `html[data-mode]` line, `road: <n>`,
an import in `main.js`, and a watcher saying what opens it. Four of the five places
after la rivière needed **no engine change**; the exception is `le clocher`, which
needed a synth voice taking a pitch, because a fixed arpeggio cannot spell a phrase.

## The animals

| animal | where | what it is |
|---|---|---|
| Nuage | everywhere | the sheep, and a piece at la rivière and le pont |
| `le chien` | the meadow, and la lisière | the second animal, and the piece the wood's edge turns on |
| the flock | le pont | three lambs, each wearing its pace on an ear tag |
| the fox | la lisière | scenery with a motive — he never takes anything |

Le chien is drawn once, in [`world/chien.js`](src/world/chien.js), and la lisière
asks for him — so the dog on the perch and the dog in the grass cannot drift into
two animals that merely look alike. He runs on **no clock**: petting him fills
nothing and is late for nothing, because happiness is the only clock allowed to
empty and a companion who needed topping up would be a chore.

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
| `geometry` | seven rooms × ten viewports: no sideways scroll, nothing overflowing, the sheep never cut off, chrome never overlapping, and every way out both reachable and at least 38px across |
| `interactions` | every verb, the shearing gate, hit-testing where things look clickable, and that nothing invisible is tabbable |
| `puzzles` | the optimal solution wins, both illegal pairs are caught, and a mistake is always a rewind — never a loss |
| `barn` | the door is earned by shearing, a big bale is refused kindly, and the optimal seven says so |
| `pont` | two at a time, the minutes only add up, and — measured in composited pixels — the dark of the cleft costs the mood no more than the dimmest place already built |
| `clocher` | the phrase is learned by ear and rung back, and a wrong bell costs a replay and nothing else |
| `cloture` | all 128 fences finishable with a unique answer, and a fresh one never already lit |
| `lisiere` | the closed-form minimum against an exhaustive search of all 336 boards, the dog on no clock, the fox untabbable, and both ways out reachable at the end of the road |
| `travel` | he crosses ground on screen rather than riding, the destination lands squarely in frame, and a stroke across his back is never a swipe |
| `day` | noon costs nothing, night keeps two thirds of noon's mood separation, and la pelote rolls to a stop without leaving the meadow |
| `save` | the clocks survive a reload and never rewind; a corrupt save still opens onto a meadow |

Two of these read actual pixels, because some questions can only be settled by
looking at what the compositor did. A blend mode's effect on the distance between
two palettes is one: modelling it means assuming a grade colour and ignoring every
layer over it, and the modelled answer and the real one differ by a lot.
