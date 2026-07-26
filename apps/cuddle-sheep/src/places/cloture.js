// La clôture — seven lanterns along a fence at the end of the day, and touching
// one post wakes the ones either side of it.
//
// Outdoors, so unlike le pont there is NO backdrop here: the valley's own sky
// stands behind the fence, which is the whole point of having built a sky that
// follows the player's clock. A place only paints its own sky when it is somewhere
// the sky cannot reach, and a field is not that.
//
// The board is built by unlighting a finished fence rather than by scattering
// lanterns, so it can always be finished — see puzzles/cloture.js for why that
// also hands over the minimum for free.
import { $, el } from "../engine/svg.js";
import { rand, now, REDUCED } from "../engine/math.js";
import { kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { sparkle } from "../engine/particles.js";
import { isoX, isoY, pt, poly, boxAt, pine } from "../engine/iso.js";
import { panTo } from "../engine/camera.js";
import { state } from "../state.js";
import { announce, setHint } from "../ui/hint.js";
import { measureUI } from "../ui/hud.js";
import { refreshCTM, poke } from "../world/pointer.js";
import { unhost } from "../world/host.js";
import { dropShears } from "../world/wool.js";
import { cancelDrag } from "../world/clovers.js";
import { release } from "../world/hands.js";
import * as valley from "../world/valley.js";
import { HOME } from "../engine/save.js";
import { SOLVES_TO_OPEN_CLOTURE } from "../rules.js";
import { POSTS, toggle, solved, fewest, start } from "../puzzles/cloture.js";
import { history, fanfare } from "../puzzles/board.js";
import { mount, unmount, enrol } from "./registry.js";
import { dioramaFor } from "./diorama.js";
import { edges } from "./edges.js";
import { go } from "./travel.js";

const stage = $("#stage");
const fenceTouches = $("#fenceTouches");

// frame 4 of the filmstrip
const scene = dioramaFor("cloture", 4);
const { decor, layers } = scene;

const GROUND = 0.5;             // the field's surface
const FENCE_GY = 1.7;           // the line the posts stand on
const POST_H = 1.5;
const AT = [...Array(POSTS).keys()].map((i) => 0.5 + i * 1.2);
const HIS = [3.8, 3.3];

const past = history();

const game = {
  on: false, built: false, seen: false, phase: "idle",
  lit: [], touches: 0, best: 0, posts: [], lamps: [], glows: [],
};

/* ---- world building ---------------------------------------------------- */
const buildWorld = () => {
  if (game.built) return;
  game.built = true;

  // the field: one slab, and a hedge line behind the fence so the eye stops
  boxAt(decor, -1.2, -1.4, 10.6, 7.2, 0, GROUND,
    "var(--cloture-grass)", "var(--cloture-grass-l)", "var(--cloture-grass-r)");

  for (const [gx, gy, k] of [[-0.9, -1.0, 0.95], [1.4, -1.2, 0.8], [4.2, -1.3, 0.9],
    [6.8, -1.1, 0.85], [8.8, -0.6, 1.0], [9.0, 3.4, 1.05]]) {
    pine(decor, gx, gy, k);
  }

  // mown stripes, which is what says "a field somebody looks after"
  for (const i of [...Array(9).keys()]) {
    const gy = -1.2 + i * 0.8;
    poly(decor, [pt(-1.1, gy, GROUND + 0.002), pt(9.3, gy, GROUND + 0.002),
      pt(9.3, gy + 0.4, GROUND + 0.002), pt(-1.1, gy + 0.4, GROUND + 0.002)].join(" "),
    "var(--cloture-mown)", 0.28);
  }

  for (const i of [...Array(34).keys()]) {
    const gx = rand(-1.0, 9.2), gy = rand(-1.2, 5.6);
    const x = isoX(gx, gy), y = isoY(gx, gy, GROUND);
    decor.appendChild(el("path", {
      d: `M${x.toFixed(1)},${y.toFixed(1)} q${rand(-3, 3).toFixed(1)},-6 ${rand(-2, 2).toFixed(1)},-12`,
      stroke: "var(--cloture-tuft)", "stroke-width": 1.9, fill: "none", "stroke-linecap": "round", opacity: ".85",
    }));
  }

  // the rails, drawn before the posts so the posts sit in front of them
  for (const z of [0.55, 1.0]) {
    poly(decor, [pt(AT[0], FENCE_GY - 0.05, GROUND + z), pt(AT[POSTS - 1], FENCE_GY - 0.05, GROUND + z),
      pt(AT[POSTS - 1], FENCE_GY + 0.05, GROUND + z), pt(AT[0], FENCE_GY + 0.05, GROUND + z)].join(" "),
    "var(--cloture-rail)");
    poly(decor, [pt(AT[0], FENCE_GY + 0.05, GROUND + z), pt(AT[POSTS - 1], FENCE_GY + 0.05, GROUND + z),
      pt(AT[POSTS - 1], FENCE_GY + 0.05, GROUND + z - 0.1), pt(AT[0], FENCE_GY + 0.05, GROUND + z - 0.1)].join(" "),
    "var(--cloture-rail-l)");
  }

  /* ---- seven posts, seven lanterns ---- */
  for (const [i, gx] of AT.entries()) {
    boxAt(decor, gx - 0.07, FENCE_GY - 0.07, 0.14, 0.14, GROUND, POST_H,
      "var(--cloture-post)", "var(--cloture-post-l)", "var(--cloture-post-r)");

    const px = isoX(gx, FENCE_GY), py = isoY(gx, FENCE_GY, GROUND + POST_H);
    const hit = el("g", { id: `post-${i}`, class: "lamppost", tabindex: "0", role: "button" });
    hit.setAttribute("aria-label", `Lanterne ${i + 1} — lantern ${i + 1}`);
    // a real target: the whole post, not the pane of glass on top of it
    hit.appendChild(el("rect", {
      x: (px - 26).toFixed(1), y: (py - 42).toFixed(1),
      width: 52, height: POST_H * 30 + 58, fill: "transparent",
    }));

    // the glow goes UNDER the lantern, so a lit lantern spills onto the grass
    const glow = el("g", { class: "lamppost__glow" });
    for (const [r, o] of [[54, 0.1], [32, 0.14], [17, 0.24]]) {
      glow.appendChild(el("circle", { cx: px.toFixed(1), cy: (py - 16).toFixed(1), r, fill: "var(--cloture-flame)", opacity: o }));
    }
    hit.appendChild(glow);

    const lamp = el("g", { class: "lamppost__lamp", transform: `translate(${px.toFixed(1)} ${py.toFixed(1)})` });
    lamp.innerHTML = `
      <path d="M-8,-38 q8,-9 16,0" stroke="var(--cloture-iron)" stroke-width="2" fill="none"/>
      <polygon points="-9,-34 9,-34 6,-30 -6,-30" fill="var(--cloture-iron)"/>
      <polygon points="-6,-30 6,-30 7,-11 -7,-11" fill="var(--cloture-glass)"/>
      <polygon points="-7,-11 7,-11 9,-7 -9,-7" fill="var(--cloture-iron)"/>
      <ellipse class="lamppost__flame" cx="0" cy="-19" rx="3.2" ry="5.4" fill="var(--cloture-flame)"/>`;
    hit.appendChild(lamp);

    layers.add(hit, () => gx + FENCE_GY, `post-${i}`);
    game.posts.push(hit);
    hit.addEventListener("pointerdown", (e) => { e.stopPropagation(); touch(i); });
    hit.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); touch(i); }
    });
  }

  ways.out = edges(scene, place, isoY(4.5, 2.5, GROUND), go, exit);
  ways.out.sync();
};

/* ---- drawing ---------------------------------------------------------- */
const draw = () => {
  for (const [i, node] of game.posts.entries()) {
    node.classList.toggle("lit", !!game.lit[i]);
  }
  scene.host(isoX(...HIS), isoY(HIS[0], HIS[1], GROUND));
  layers.sort(HIS[0] + HIS[1]);
};

/* ---- what the fence says about itself --------------------------------- */
const readout = () => {
  const on = game.lit.filter(Boolean).length;
  const dark = game.lit.map((v, i) => (v ? null : i + 1)).filter(Boolean);
  announce(on === POSTS
    ? `Les sept lanternes sont allumées.`
    : `${on} lanterne${on > 1 ? "s" : ""} sur ${POSTS}. Éteinte${dark.length > 1 ? "s" : ""} : ${dark.join(", ")}.`);
};

const setTouches = () => {
  fenceTouches.textContent = `${game.touches} touche${game.touches > 1 ? "s" : ""}`;
  $("#fenceUndo").disabled = past.depth === 0;
};

const syncPosts = () => {
  const live = game.phase === "idle";
  for (const node of game.posts) {
    node.toggleAttribute("disabled", !live);
    node.setAttribute("tabindex", live ? "0" : "-1");
  }
  setTouches();
};

/* ---- moves ------------------------------------------------------------ */
const touch = (at) => {
  if (!game.on || game.phase !== "idle") return;
  poke();
  past.push({ lit: [...game.lit], touches: game.touches });
  game.lit = toggle(game.lit, at);
  game.touches += 1;
  // a lantern coming on is a small warm event; one going off is the same event
  // backwards, and neither is a mistake — there is nothing to lose on this fence
  sfx.bell(game.lit[at] ? 784 : 523);
  kick("earL", -60); kick("earR", 60);
  if (game.lit[at] && !REDUCED) {
    const px = isoX(AT[at], FENCE_GY);
    for (const k of [...Array(3).keys()]) setTimeout(() => sparkle(px - 200 + rand(-8, 8), 120 + rand(-8, 8)), k * 70);
  }
  setTouches(); draw();
  if (solved(game.lit)) return win();
  readout(); remember();
};

const win = () => {
  game.phase = "won";
  syncPosts();
  fanfare("cloture");
  const best = game.touches === game.best ? " C'est le minimum." : "";
  announce(`Les sept lanternes sont allumées, en ${game.touches} touches.${best}`);
  setHint(`Toute la clôture éclairée en ${game.touches} touches${game.touches === game.best ? ", le minimum" : ""}`,
    `the whole fence lit in ${game.touches}${game.touches === game.best ? " — the minimum" : ""}`);
  remember();
};

const undo = () => {
  if (!game.on || !past.depth) return;
  const prev = past.pop();
  game.lit = [...prev.lit];
  game.touches = prev.touches;
  game.phase = "idle";
  syncPosts(); draw(); readout(); remember();
};

const resetBoard = (animate = true) => {
  game.lit = start(Math.random, 4 + Math.floor(Math.random() * 3));
  game.best = fewest(game.lit);
  game.touches = 0;
  game.phase = "idle";
  past.clear();
  layers.reset();
  syncPosts(); draw(); measureUI();
  remember();
  if (animate) readout();
};

/* ---- the board, written down ------------------------------------------ */
const serialize = () => ({
  lit: game.lit.map(Boolean), touches: game.touches, best: game.best,
  phase: game.phase === "won" ? "won" : "idle", past: past.all(),
});

/** Seven lanterns and a finishable fence, or the board is refused whole. The
 *  finishable part is not paranoia: a board that cannot be completed is exactly
 *  what this puzzle promises never to hand out, so one arriving from storage is
 *  a board from some other build and not a board at all. */
const deserialize = (blob) => {
  if (!blob || typeof blob !== "object" || !Array.isArray(blob.lit)) return false;
  if (blob.lit.length !== POSTS) return false;
  const lit = blob.lit.map(Boolean);
  if (fewest(lit) === null) return false;
  game.lit = lit;
  game.touches = Number.isFinite(blob.touches) && blob.touches >= 0 ? blob.touches : 0;
  game.best = Number.isFinite(blob.best) && blob.best > 0 ? blob.best : fewest(lit);
  game.phase = blob.phase === "won" && solved(lit) ? "won" : "idle";
  past.load(blob.past);
  return true;
};

const remember = () => valley.keep("cloture", serialize());

/* ---- the three beats of arriving somewhere ---------------------------- */
const wake = () => { buildWorld(); scene.show(true); };
const leave = () => { game.on = false; };
const sleep = () => { scene.show(false); game.on = false; };
const land = () => {
  game.on = true;
  ways.out?.sync();
  syncPosts(); draw(); measureUI();
  setHint("Allume les sept — un poteau réveille aussi ses voisins",
    "light all seven — a post wakes its neighbours too");
  setTimeout(() => { refreshCTM(); draw(); measureUI(); }, 20);
  setTimeout(refreshCTM, 1000);
  readout();
};

/* ---- entering and leaving -------------------------------------------- */
export const enter = () => {
  if (game.on || !valley.opened("cloture")) return;
  wake();
  poke();
  mount(place);
  panTo(4, true);
  valley.arrive("cloture");
  release();
  dropShears();
  cancelDrag();
  if (!game.seen) { game.seen = true; if (!deserialize(valley.board("cloture"))) resetBoard(false); }
  land();
  stage.classList.add("gliding");
  setTimeout(() => stage.classList.remove("gliding"), 1000);
};

export const exit = () => {
  if (!game.on) return;
  game.on = false;
  if (game.phase !== "won") game.phase = "idle";
  unmount();
  unhost();
  valley.arrive(HOME);
  scene.show(false);
  stage.classList.remove("gliding");
  setTimeout(refreshCTM, 60);
  setTimeout(refreshCTM, 700);
  announce("Retour au pré.");
};

/* ---- bound at boot; the fence is not built until the first visit ------- */
export const build = () => {
  $("#fenceUndo").addEventListener("click", undo);
  $("#fenceReset").addEventListener("click", () => { resetBoard(); sfx.flutter(); });

  addEventListener("keydown", (e) => {
    if (!game.on) return;
    if (e.key === "Escape") { exit(); return; }
    const k = e.key.toLowerCase();
    if (k === "r") { resetBoard(); return; }
    if ((e.key === "z" && (e.ctrlKey || e.metaKey)) || e.key === "Backspace") { e.preventDefault(); undo(); return; }
    const n = ["1", "2", "3", "4", "5", "6", "7"].indexOf(e.key);
    if (n !== -1) { e.preventDefault(); touch(n); }
  });

  // opened by having walked the bridge: a lantern carried across a cleft, then
  // seven of them standing still
  const watch = () => {
    if (valley.opened("cloture") || valley.solves("pont") < SOLVES_TO_OPEN_CLOTURE) return;
    if (!valley.open("cloture")) return;
    setTimeout(() => sfx.chime(), 400);
    setTimeout(() => setHint("Une clôture de lanternes, plus loin — la clôture",
      "a fence of lanterns, further on — the fence"), 800);
    announce("La clôture est ouverte, plus loin dans la vallée : suis le panneau.");
  };
  valley.watch(watch);
  watch();
};

/* ---- per-frame: the flames breathe ------------------------------------- */
const frame = (dt, t) => {
  if (!REDUCED) {
    for (const [i, node] of game.posts.entries()) {
      if (!game.lit[i]) continue;
      // each flame on its own phase, or seven lanterns pulse as one lamp
      node.style.setProperty("--flick", (0.9 + Math.sin(t * 3.1 + i * 1.7) * 0.12).toFixed(3));
    }
  }
  if (!REDUCED && state.mood > 0.5 && Math.random() < dt * 0.9) sparkle(rand(150, 250), rand(150, 250));
  draw();
};

const ways = {};

const place = {
  id: "cloture",
  mode: "fence",
  road: 4,
  label: ["la clôture", "the fence"],
  doorway: (dir) => ways.out.doorAt(dir),
  frame,
  wake, leave, sleep, land,
  enter, exit,
  // a tap on him touches the post he is standing nearest, which is the middle one
  tapSheep: () => touch(3),
};

enrol(place);
export default place;
