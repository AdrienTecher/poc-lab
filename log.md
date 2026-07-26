# Log

Append-only, newest first: `## [YYYY-MM-DD] <type> | <summary>`.

## [2026-07-26] feat | cuddle-sheep learns to walk — a road between la rivière and la grange with a signpost at each end, a thumb-swipe across the sky, and a save that puts him back where he was left. The camera is derived from him rather than driven at the destination: two springs covering the same distance would pin him near the middle of the frame with only his legs moving, so instead there is a dead band at the centre of the shot that he pushes when he leaves it — he crosses ground at both ends and the world slides in the middle. The HUD map the plan asked for is deferred: measurement says the header has -6px of slack at 320x568 before adding anything, and with two places both reachable from the meadow and from each other there is nothing yet to navigate

## [2026-07-26] feat | cuddle-sheep grows a valley — the two layers stop being "the crossing" and become a filmstrip whose camera is one number, the shared viewBox min-x, with the projection asking getScreenCTM() for the browser's own matrix instead of hand-copying the letterbox solve; la grange arrives as the second place (hay-bale Hanoi, where the bales ARE the fleeces shorn and Nuage is the crane rather than a piece) for the cost of one module, one pure ruleset and a palette — no engine change, which was the question the phase asked. A design panel caught, and direct measurement confirmed, that overflow:hidden on an <svg> clips to the CSS box and not the viewBox: 112 units of letterbox bleed at 1280x800 and 359 at phone-landscape would have shown the barn from the river on six of ten viewports with nothing failing, so a sleeping diorama now leaves the document entirely

## [2026-07-26] refactor | cuddle-sheep phase 0 closed — the world leaves main.js, which becomes a 60-line composition root over world/ (what he is), places/ (where he goes), puzzles/ (the rules of a place) and ui/; the two couplings that would have blocked a second place are broken rather than moved — progression becomes a store both the clover patch and the door watch, and "which place is mounted" a registry that imports nothing — with eight new checks over the door and the shears keyboard, the two paths the suite never drove

## [2026-07-26] refactor | cuddle-sheep engine lifted out — ten modules (math, svg, spring, audio, particles, iso, depth, save, rules, state) leave main.js as the composition root; painter order around the sheep becomes computed instead of four hand-written re-parentings, and an adversarial review of the refactor found six real defects (a mute that inverted on reload, a lost +30s top-up, focus destroyed by re-parenting, a crossing that could land on a reset board) plus four tests that would have passed on a broken app

## [2026-07-26] build | cuddle-sheep becomes a buildable app — phase 0 of growing the toy into a game: index.html is a shell over src/, the Playwright suite (geometry over ten viewports, interactions, puzzles, save) is checked in and runs against the built artifact, and the five loose localStorage keys become one versioned save that migrates and degrades safely

## [2026-07-26] feat | lexicon: French bank taken to 500 words (200 English), and a share control — native sheet with the PNG where the browser takes files, otherwise X/Bluesky/LinkedIn/WhatsApp/Telegram plus copy link and image; entries addressable via ?w=<slug>

## [2026-07-25] feat | cuddle-sheep gains a fleece and a puzzle — wool grows on a 15-minute clock and is sheared with shears picked up from the grass; five clovers grow a four-leaf clover that opens "la traversée", an isometric wolf/sheep/cabbage crossing where Nuage himself is the piece

## [2026-07-25] intake | make lexicon bilingual — a second bank of 200 rare French words beside the English one, language switch remembered and linkable; folio numbering in the gallery made stable by creation order instead of display position

## [2026-07-25] render | rebuild the landing page for scale — search, tag facets, sort, cards/index density, URL state, self-hosted fonts; 100 apps go from 12.4 to 5.3 screens

## [2026-07-25] intake | add el-nino-2026 — the ENSO explainer made bilingual FR/EN (markup is the French source, English is an override map), one teleconnection thread drawn from the Pacific source to the selected region, and the missing "not El Niño" share restored in the probability bars

## [2026-07-25] intake | add canicule-appartement — heat-wave planner rebuilt around a single threshold, the indoor temperature: dark mode, persisted location/settings, night bands and a keyboard-walkable chart, cross-ventilation as an explicit setting, opt-in newborn and frail-person profiles

## [2026-07-25] intake | add cuddle-sheep (Nuage) — hand-rigged SVG sheep on a spring system; stroking him fills a cuddle that buys five minutes of visible happiness, the whole scene keying on one mood variable

## [2026-07-25] intake | add lexicon — rare-word draw over 200 curated entries (8 domains × 5 levels), toggleable domains and a canvas-rendered front/back memory card as PNG

## [2026-07-17] render | redesign gallery landing page — per-app identity hues, masthead spectrum, Space Grotesk/Plex Mono, explicit description_en field

## [2026-07-17] intake | add five apps from claude.ai artifacts — quiz-tnd (buildable React) plus s1-improv-setups, ukulele-c-minor-blues, slice-the-beat, brawl-combo-lab (static)

## [2026-07-16] init | scaffold poc-lab — build/gallery/validate/deploy pipeline, Vite template, and vendored atelier conventions; ships the landing page only (apps added later via the intake process)
