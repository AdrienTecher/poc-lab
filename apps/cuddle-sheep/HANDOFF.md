# Nuage — handoff

Everything through Phase 2 is on `main` at `fb918ae`, deployed, **136/136 green**.
This is what a fresh session needs to pick it up.

## 1. First, the thing that is broken about this environment

Commits made in the remote session are **unsigned**. Not fixable there:
`/root/.gitconfig` sets `commit.gpgsign=true` with
`user.signingkey=/home/claude/.ssh/commit_signing_key.pub`, and that file is
**0 bytes with no private key beside it**; `ssh-keygen` is not installed either.
Author and committer are already correct (`Claude <noreply@anthropic.com>`), so
the usual `--reset-author` advice is a no-op.

Locally, with a real key:

```bash
git rebase --exec "git commit --amend --no-edit -S" b225cd6   # last verified commit
git push --force-with-lease origin main
```

`b225cd6` is the last commit before this run. Everything after it is unsigned.
Rewriting is a force-push over published, deployed history — deliberate choice,
not a cleanup.

## 2. Run it

```bash
pnpm build                                        # from the repo root, into dist/
CHROMIUM=/path/to/chrome node apps/cuddle-sheep/tests/run.mjs        # all specs
CHROMIUM=... node apps/cuddle-sheep/tests/run.mjs day travel         # some specs
```

The suite drives the **built** artifact over HTTP at the real
`/poc-lab/cuddle-sheep/` base. Playwright is deliberately not a dependency of
the package. Full run is ~7 minutes; run **one at a time** — concurrent runs
fight over the server port and hang.

## 3. Shape

`main.js` is a 70-line composition root: build in order, then one frame loop.

| tree | what lives there |
|---|---|
| `engine/` | world-agnostic: springs, particles, synth, 2:1 iso kit, painter order, camera, save |
| `world/` | what he *is*: rig, mood, fleece, clovers, pelote, hands, daylight, progression |
| `places/` | where he *goes*: one diorama per module, one mounted at a time, travel between |
| `puzzles/` | rules as pure functions, plus the two things two puzzles share |
| `ui/` | the chrome: two clock rings, hint bubble, live region |

## 4. Invariants — break these and the game stops being itself

1. **`--m` is the spine.** Mood is the *distance* between the happy and sad
   palettes. Anything laid over the scene scales that distance too. `day.spec`
   screenshots the sky at both moods and requires night to keep ≥66% of noon's
   separation (currently 70%). If you darken night, re-measure.
2. **Wool is a body state, mood is a feeling state.** Nothing in `wool.js`
   writes `happyUntil`, `cuddle` or `--m`. Shearing *reads* mood as a gate.
3. **Only one clock may ever empty.** Happiness is it. Everything added since
   only fills. An emptying clock is the only kind that can make you late, and
   lateness is what a chore list is made of.
4. **A clock earns a HUD readout only if you can act on it right now.** The day
   is drawn as the sky, not as a chip. The HUD measured **−6px of slack at
   320×568** before anything was added — it is full.
5. **Keys only ever open.** Any place can be left at any moment; the signpost is
   never disabled, not even on a solved board.
6. **Painter order is computed.** He is a DOM actor between two SVG layers;
   every piece declares `gx + gy` and `engine/depth.js` files it.
7. **A sleeping diorama leaves the document.** `overflow:hidden` on an `<svg>`
   clips to the CSS box, *not* the viewBox — letterbox margins paint live user
   space (112 units at 1280×800, 359 at phone-landscape, against a 728 pitch).
8. **Never `git add -A`.** Stage explicit paths. A background agent once edited
   the tree mid-commit and it shipped.

## 5. What is left

### Phase 3 — the roster
`le pont` (bridge-and-torch, at dusk), `la clôture` (lights-out fence),
`le clocher` (bell melody, reuses the synth), `la lisière` (fox and hens), plus
a second animal that is also a game piece. *Retires: can a place ship in a day?*

Adding a place today costs: one module in `places/`, one pure ruleset in
`puzzles/`, a palette block, a door in the meadow, and `road: <n>` on the
filmstrip. `la grange` needed **zero** engine changes — that is the bar.

The multi-plank signpost already scales; with 3+ places it becomes the map it
was designed to be, and that is when to check whether walking through
intermediate places is tedious.

### Phase 4 — the object
PWA manifest + offline cache, full i18n pass (copy is currently inline
FR-with-EN), audio mix, reduced-motion pass, proper first-run.

### Carried-forward, smaller
- **Arrow keys don't travel** — `la rivière` claims them for the boat. Travel is
  Tab-to-plank, swipe, or `Escape`. Unresolved, not urgent.
- **`la grange`'s bale carry is a straight lerp** — he does not walk the arc a
  loaded animal would. Cosmetic.

## 6. Design decisions already made, with reasons

- **Hourly clover growth was cut.** It feeds the five-clover door, and a key
  that arrives by waiting is not care. Also: `clovers.grow()` already reads
  `solves`, so a fuller patch already means "you solved something" — two causes
  for one signal.
- **The map is a signpost, not a panel.** Navigation is objects in the world;
  the HUD has no room and a menu would be the one non-diegetic element.
- **The travel camera comes off trip progress, not his position.** A camera
  derived from where he *is* can only travel as far as he does, and two doorways
  are much closer together than the frames are wide — it left the barn 470 units
  off-centre. `smootherstep`, and `g(1) = 1` makes arrival framing exact.
- **Undo and Rejouer stay as chrome.** They are meta actions; dressing them as
  objects would be costume, not immersion.
