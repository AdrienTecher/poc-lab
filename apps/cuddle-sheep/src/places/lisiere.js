// La lisière — three hens along a perch, a dog who can watch three boxes at a
// time, and a fox at the treeline who never actually takes anything.
//
// The sixth place, and the one that had to work hardest not to repeat itself. The
// obvious fox-and-hens is fox-goose-corn, which is la traversée with the pieces
// renamed — so the fox here is scenery with a motive rather than a rule, and what
// the place asks instead is a gathering problem: get all three hens inside the
// span the dog can watch, in as few moves as you can.
//
// That has no losing move and no clock, and its minimum is exact rather than
// estimated — see puzzles/lisiere.js. The fox is drawn because dusk at a wood's
// edge without one would be a lie about where you are, not because he is a threat.
// Nothing in this place can be lost.
import { $, el } from "../engine/svg.js";
import { say } from "../ui/copy.js";
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
import { dogArt } from "../world/chien.js";
import * as valley from "../world/valley.js";
import { HOME } from "../engine/save.js";
import { SOLVES_TO_OPEN_LISIERE } from "../rules.js";
import { BOXES, HENS, SPAN, SPOTS, sorted, solved, fewest, refuses, start } from "../puzzles/lisiere.js";
import { history, fanfare } from "../puzzles/board.js";
import { mount, unmount, enrol } from "./registry.js";
import { dioramaFor } from "./diorama.js";
import * as neighbours from "./neighbours.js";
import { edges } from "./edges.js";
import { go } from "./travel.js";

const stage = $("#stage");
const edgeMoves = $("#edgeMoves");

// frame 5 of the filmstrip
const scene = dioramaFor("lisiere", 5);
const { decor, layers } = scene;

const GROUND = 0.5;
const RAIL_GY = 1.5, RAIL_Z = 1.15;      // the perch the boxes sit on
const DOG_GY = 2.7;                      // he lies below it, watching
const HIS = [4.2, 3.6];
const AT = [...Array(BOXES).keys()].map((i) => 0.5 + i * 1.08);

const past = history();

const game = {
  on: false, built: false, seen: false, phase: "idle",
  hens: [], dog: 0, moves: 0, best: 0,
  pick: null,                            // null | {kind:"hen", at} | {kind:"dog"}
  boxes: [], henNodes: [], dogNode: null,
};

/* ---- geometry ---------------------------------------------------------- */
const boxSpot = (i) => [isoX(AT[i], RAIL_GY), isoY(AT[i], RAIL_GY, RAIL_Z)];
const watched = (i) => i >= game.dog && i < game.dog + SPAN;
const dogSpot = () => {
  const mid = AT[game.dog] + (AT[game.dog + SPAN - 1] - AT[game.dog]) / 2;
  return [isoX(mid, DOG_GY), isoY(mid, DOG_GY, GROUND)];
};

/* ---- world building ---------------------------------------------------- */
const buildWorld = () => {
  if (game.built) return;
  game.built = true;

  boxAt(decor, -1.2, -1.6, 11.4, 7.4, 0, GROUND,
    "var(--lisiere-grass)", "var(--lisiere-grass-l)", "var(--lisiere-grass-r)");

  // the wood: a treeline dense enough to read as somewhere a fox comes from
  for (const [gx, gy, k] of [[-1.0, -1.4, 1.15], [0.4, -1.5, 0.95], [1.9, -1.6, 1.1],
    [3.4, -1.4, 0.9], [4.9, -1.6, 1.05], [6.4, -1.5, 0.95], [7.9, -1.4, 1.1],
    [9.3, -1.2, 1.0], [9.6, 2.4, 1.05], [9.8, 5.2, 0.9]]) {
    pine(decor, gx, gy, k);
  }
  // bracken at the foot of the trees
  for (const i of [...Array(26).keys()]) {
    const gx = rand(-1.0, 9.4), gy = rand(-1.4, -0.2);
    const x = isoX(gx, gy), y = isoY(gx, gy, GROUND);
    decor.appendChild(el("path", {
      d: `M${x.toFixed(1)},${y.toFixed(1)} q${rand(-4, 4).toFixed(1)},-7 ${rand(-3, 3).toFixed(1)},-14`,
      stroke: "var(--lisiere-fern)", "stroke-width": 2.1, fill: "none", "stroke-linecap": "round", opacity: ".9",
    }));
  }

  /* ---- the fox: at the treeline, watching, and that is all he ever does ---- */
  const fx = isoX(-0.7, 0.4), fy = isoY(-0.7, 0.4, GROUND);
  const fox = el("g", { class: "fox", transform: `translate(${fx.toFixed(1)} ${fy.toFixed(1)})`, "aria-hidden": "true" });
  fox.innerHTML = `
    <ellipse cx="0" cy="2" rx="26" ry="7" fill="#1d2a22" opacity=".2"/>
    <path class="fox__tail" d="M-18,-16 q-17,-3 -17,-17 q9,3 15,9" fill="var(--fox-coat-l)"/>
    <line x1="-10" y1="-14" x2="-11" y2="0" stroke="var(--fox-coat-l)" stroke-width="5" stroke-linecap="round"/>
    <line x1="9" y1="-14" x2="10" y2="0" stroke="var(--fox-coat-l)" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="0" cy="-20" rx="20" ry="12" fill="var(--fox-coat)"/>
    <ellipse cx="-1" cy="-15" rx="13" ry="7" fill="var(--fox-bib)"/>
    <ellipse cx="16" cy="-28" rx="11" ry="10" fill="var(--fox-coat)"/>
    <path d="M20,-36 L26,-48 L28,-34 Z" fill="var(--fox-coat)"/>
    <path d="M10,-36 L6,-49 L17,-38 Z" fill="var(--fox-coat)"/>
    <ellipse cx="22" cy="-24" rx="8" ry="5" fill="var(--fox-bib)"/>
    <ellipse cx="27" cy="-23" rx="3" ry="2.4" fill="#2f2733"/>
    <circle cx="20" cy="-30" r="2.3" fill="#2f2733"/>
    <circle cx="20.8" cy="-30.8" r="0.8" fill="#fff"/>`;
  decor.appendChild(fox);
  game.fox = fox;

  /* ---- the perch, and eight nest boxes on it ---- */
  poly(decor, [pt(AT[0] - 0.5, RAIL_GY - 0.06, RAIL_Z - 0.12), pt(AT[BOXES - 1] + 0.5, RAIL_GY - 0.06, RAIL_Z - 0.12),
    pt(AT[BOXES - 1] + 0.5, RAIL_GY + 0.06, RAIL_Z - 0.12), pt(AT[0] - 0.5, RAIL_GY + 0.06, RAIL_Z - 0.12)].join(" "),
  "var(--lisiere-rail)");
  for (const gx of [AT[0] - 0.4, AT[3], AT[BOXES - 1] + 0.4]) {
    boxAt(decor, gx - 0.06, RAIL_GY - 0.06, 0.12, 0.12, GROUND, RAIL_Z - GROUND - 0.12,
      "var(--lisiere-post)", "var(--lisiere-post-l)", "var(--lisiere-post-r)");
  }

  for (const i of [...Array(BOXES).keys()]) {
    const [px, py] = boxSpot(i);
    const hit = el("g", { id: `box-${i}`, class: "nest", tabindex: "0", role: "button" });
    hit.setAttribute("aria-label", `Case ${i + 1} — box ${i + 1}`);
    hit.appendChild(el("rect", { x: (px - 24).toFixed(1), y: (py - 46).toFixed(1), width: 48, height: 60, fill: "transparent" }));
    // the light the dog's attention throws: a watched box is simply brighter
    hit.appendChild(el("polygon", {
      class: "nest__watch",
      points: [pt(AT[i] - 0.44, RAIL_GY - 0.44, RAIL_Z - 0.11), pt(AT[i] + 0.44, RAIL_GY - 0.44, RAIL_Z - 0.11),
        pt(AT[i] + 0.44, RAIL_GY + 0.44, RAIL_Z - 0.11), pt(AT[i] - 0.44, RAIL_GY + 0.44, RAIL_Z - 0.11)].join(" "),
      fill: "var(--lisiere-watch)",
    }));
    const box = el("g", { class: "nest__box", transform: `translate(${px.toFixed(1)} ${py.toFixed(1)})` });
    box.innerHTML = `
      <polygon points="-17,0 17,0 17,-16 -17,-16" fill="var(--lisiere-box)"/>
      <polygon points="-17,-16 17,-16 20,-25 -20,-25" fill="var(--lisiere-roof)"/>
      <polygon points="-17,0 -17,-16 -20,-25 -20,-6" fill="var(--lisiere-box-l)"/>
      <ellipse cx="0" cy="-8" rx="7" ry="6" fill="var(--lisiere-hole)"/>`;
    hit.appendChild(box);
    layers.add(hit, () => AT[i] + RAIL_GY, `box-${i}`);
    game.boxes.push(hit);
    hit.addEventListener("pointerdown", (e) => { e.stopPropagation(); touchBox(i); });
    hit.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); touchBox(i); }
    });
  }

  /* ---- three hens ---- */
  for (const h of [...Array(HENS).keys()]) {
    const hen = el("g", { id: `hen-${h}`, class: "hen", tabindex: "0", role: "button" });
    hen.setAttribute("aria-label", `Poule ${h + 1} — hen ${h + 1}`);
    hen.innerHTML = `
      <ellipse cx="0" cy="1" rx="15" ry="4" fill="#1d2a22" opacity=".22"/>
      <path class="hen__tail" d="M-11,-14 q-11,-2 -12,-13 q8,2 12,7 Z" fill="var(--hen-wing)"/>
      <ellipse cx="0" cy="-12" rx="13" ry="11" fill="var(--hen-body)"/>
      <ellipse cx="-3" cy="-11" rx="8" ry="7" fill="var(--hen-wing)"/>
      <ellipse cx="8" cy="-22" rx="7" ry="7" fill="var(--hen-body)"/>
      <path d="M6,-30 q2,-5 5,-2 q2,4 -1,5 Z" fill="var(--hen-comb)"/>
      <polygon points="14,-21 21,-19 14,-17" fill="var(--hen-beak)"/>
      <circle cx="10" cy="-23" r="1.9" fill="#2f2733"/>
      <line x1="-3" y1="-2" x2="-4" y2="3" stroke="var(--hen-beak)" stroke-width="2" stroke-linecap="round"/>
      <line x1="4" y1="-2" x2="5" y2="3" stroke="var(--hen-beak)" stroke-width="2" stroke-linecap="round"/>`;
    layers.add(hen, () => AT[game.hens[h]] + RAIL_GY + 0.01, `hen-${h}`);
    game.henNodes.push(hen);
    hen.addEventListener("pointerdown", (e) => { e.stopPropagation(); touchHen(h); });
    hen.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); touchHen(h); }
    });
  }

  /* ---- the dog, asked for from world/chien.js so there is only ever one ---- */
  const dog = el("g", { id: "watchdog", class: "watchdog", tabindex: "0", role: "button" });
  dog.setAttribute("aria-label", "Le chien — the dog");
  dog.innerHTML = dogArt(0.92, false);
  layers.add(dog, () => AT[game.dog] + SPAN / 2 + DOG_GY, "watchdog");
  game.dogNode = dog;
  dog.addEventListener("pointerdown", (e) => { e.stopPropagation(); touchDog(); });
  dog.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); touchDog(); }
  });

  // exits are declared per place because the ground is not the same shape twice:
  // ground -1.2..10.2 x -1.6..5.8
  ways.out = edges(scene, place, { z: GROUND, west: [-0.1, 4.2], east: [9.1, 4.2], home: [2.0, 5.2] }, go, exit);
  ways.out.sync();
};

/* ---- drawing ---------------------------------------------------------- */
const draw = () => {
  for (const [h, at] of game.hens.entries()) {
    const [px, py] = boxSpot(at);
    game.henNodes[h].setAttribute("transform", `translate(${px.toFixed(1)} ${(py - 14).toFixed(1)})`);
    game.henNodes[h].classList.toggle("chosen", game.pick?.kind === "hen" && game.pick.at === h);
    game.henNodes[h].classList.toggle("safe", watched(at));
  }
  const [dx, dy] = dogSpot();
  game.dogNode.setAttribute("transform", `translate(${dx.toFixed(1)} ${dy.toFixed(1)})`);
  game.dogNode.classList.toggle("chosen", game.pick?.kind === "dog");
  for (const [i, node] of game.boxes.entries()) {
    node.classList.toggle("watched", watched(i));
    node.classList.toggle("free", game.pick !== null && !game.hens.includes(i));
  }
  scene.host(isoX(...HIS), isoY(HIS[0], HIS[1], GROUND));
  layers.sort(HIS[0] + HIS[1]);
};

/* ---- what the wood's edge says about itself ---------------------------- */
const readout = () => {
  const safe = game.hens.filter((at) => watched(at)).length;
  const held = game.pick?.kind === "hen" ? ` Poule ${game.pick.at + 1} choisie.`
    : game.pick?.kind === "dog" ? " Le chien est choisi." : "";
  announce(say.lisiere.watching(game.dog + 1, game.dog + SPAN,
    sorted(game.hens).map((a) => a + 1).join(", "), safe, HENS, held));
};

const setMoves = () => {
  edgeMoves.textContent = `${game.moves} pas`;
  $("#edgeUndo").disabled = past.depth === 0;
};

const syncPieces = () => {
  const live = game.phase === "idle";
  for (const node of [...game.henNodes, game.dogNode, ...game.boxes]) {
    node.toggleAttribute("disabled", !live);
    node.setAttribute("tabindex", live ? "0" : "-1");
  }
  setMoves();
};

/* ---- moves ------------------------------------------------------------ */
const touchHen = (h) => {
  if (!game.on || game.phase !== "idle") return;
  poke();
  game.pick = game.pick?.kind === "hen" && game.pick.at === h ? null : { kind: "hen", at: h };
  sfx.flutter();
  draw(); readout();
};

const touchDog = () => {
  if (!game.on || game.phase !== "idle") return;
  poke();
  game.pick = game.pick?.kind === "dog" ? null : { kind: "dog" };
  sfx.purr();
  draw(); readout();
};

const touchBox = (i) => {
  if (!game.on || game.phase !== "idle") return;
  if (!game.pick) {
    // an empty tap is a chance to say what a tap is FOR, rather than nothing
    const on = game.hens.indexOf(i);
    if (on !== -1) return touchHen(on);
    sfx.whiff();
    setHint(...say.lisiere.pickFirst);
    return;
  }
  poke();

  if (game.pick.kind === "dog") {
    const to = Math.max(0, Math.min(SPOTS - 1, i));
    if (to === game.dog) { game.pick = null; draw(); readout(); return; }
    past.push({ hens: [...game.hens], dog: game.dog, moves: game.moves });
    game.moves += Math.abs(to - game.dog);     // he walks it, so it costs the walk
    game.dog = to;
    game.pick = null;
    sfx.purr();
    after();
    return;
  }

  const h = game.pick.at, from = game.hens[h];
  const why = refuses(game.hens, from, i);
  if (why) {
    sfx.whiff();
    setHint(...(why === "taken" ? say.lisiere.taken : say.lisiere.already));
    announce(why === "taken" ? say.lisiere.takenSaid : say.lisiere.alreadySaid);
    return;
  }
  past.push({ hens: [...game.hens], dog: game.dog, moves: game.moves });
  game.moves += Math.abs(i - from);            // a box per beat of wing
  game.hens[h] = i;
  game.pick = null;
  sfx.flutter();
  kick("earL", -60); kick("earR", 60);
  after();
};

/** What follows any move that actually changed the board. */
const after = () => {
  setMoves(); draw();
  if (solved(game.hens, game.dog)) return win();
  readout(); remember();
};

const win = () => {
  game.phase = "won";
  syncPieces();
  fanfare("lisiere");
  const best = game.moves === game.best ? " C'est le minimum." : "";
  announce(say.lisiere.won(game.moves, best));
  setHint(...say.lisiere.wonHint(game.moves, game.moves === game.best));
  if (!REDUCED) for (const k of [...Array(8).keys()]) setTimeout(() => sparkle(rand(160, 250), rand(150, 240)), k * 90);
  remember();
};

const undo = () => {
  if (!game.on || !past.depth) return;
  const prev = past.pop();
  game.hens = [...prev.hens];
  game.dog = prev.dog;
  game.moves = prev.moves;
  game.pick = null;
  game.phase = "idle";
  syncPieces(); draw(); readout(); remember();
};

const resetBoard = (animate = true) => {
  const fresh = start(Math.random);
  game.hens = [...fresh.hens];
  game.dog = fresh.dog;
  game.best = fewest(game.hens, game.dog);
  game.moves = 0;
  game.pick = null;
  game.phase = "idle";
  past.clear();
  layers.reset();
  syncPieces(); draw(); measureUI();
  remember();
  if (animate) readout();
};

/* ---- the board, written down ------------------------------------------ */
const serialize = () => ({
  hens: [...game.hens], dog: game.dog, moves: game.moves, best: game.best,
  phase: game.phase === "won" ? "won" : "idle", past: past.all(),
});

/** Three hens in three different boxes and a dog whose span fits on the perch, or
 *  the board is refused whole. */
const deserialize = (blob) => {
  if (!blob || typeof blob !== "object" || !Array.isArray(blob.hens)) return false;
  if (blob.hens.length !== HENS) return false;
  if (!blob.hens.every((a) => Number.isInteger(a) && a >= 0 && a < BOXES)) return false;
  if (new Set(blob.hens).size !== HENS) return false;
  if (!Number.isInteger(blob.dog) || blob.dog < 0 || blob.dog >= SPOTS) return false;
  game.hens = [...blob.hens];
  game.dog = blob.dog;
  game.moves = Number.isFinite(blob.moves) && blob.moves >= 0 ? blob.moves : 0;
  game.best = Number.isFinite(blob.best) && blob.best >= 0 ? blob.best : fewest(game.hens, game.dog);
  game.phase = blob.phase === "won" && solved(game.hens, game.dog) ? "won" : "idle";
  game.pick = null;
  past.load(blob.past);
  return true;
};

const remember = () => valley.keep("lisiere", serialize());

/* ---- the three beats of arriving somewhere ---------------------------- */
const wake = () => { buildWorld(); scene.show(true); };
const leave = () => { game.on = false; };
const sleep = () => { scene.show(false); game.on = false; };
const land = () => {
  game.on = true;
  neighbours.settle(place);   // and what can be seen of next door
  game.pick = null;
  ways.out?.sync();
  syncPieces(); draw(); measureUI();
  setHint(...say.lisiere.how);
  setTimeout(() => { refreshCTM(); draw(); measureUI(); }, 20);
  setTimeout(refreshCTM, 1000);
  readout();
};

/* ---- entering and leaving -------------------------------------------- */
export const enter = () => {
  if (game.on || !valley.opened("lisiere")) return;
  wake();
  poke();
  mount(place);
  panTo(5, true);
  valley.arrive("lisiere");
  release();
  dropShears();
  cancelDrag();
  if (!game.seen) { game.seen = true; if (!deserialize(valley.board("lisiere"))) resetBoard(false); }
  land();
  stage.classList.add("gliding");
  setTimeout(() => stage.classList.remove("gliding"), 1000);
};

export const exit = () => {
  if (!game.on) return;
  game.on = false;
  if (game.phase !== "won") game.phase = "idle";
  game.pick = null;
  unmount();
  unhost();
  valley.arrive(HOME);
  neighbours.clear();   // the neighbours go with him; nothing is left on screen
  stage.classList.remove("gliding");
  setTimeout(refreshCTM, 60);
  setTimeout(refreshCTM, 700);
  announce(say.road.home);
};

/* ---- bound at boot; the wood's edge is not built until the first visit -- */
export const build = () => {
  $("#edgeUndo").addEventListener("click", undo);
  $("#edgeReset").addEventListener("click", () => { resetBoard(); sfx.flutter(); });

  addEventListener("keydown", (e) => {
    if (!game.on) return;
    if (e.key === "Escape") { exit(); return; }
    const k = e.key.toLowerCase();
    if (k === "r") { resetBoard(); return; }
    if (k === "c") { e.preventDefault(); touchDog(); return; }
    if ((e.key === "z" && (e.ctrlKey || e.metaKey)) || e.key === "Backspace") { e.preventDefault(); undo(); return; }
    const n = ["1", "2", "3", "4", "5", "6", "7", "8"].indexOf(e.key);
    if (n !== -1) { e.preventDefault(); touchBox(n); }
  });

  // opened by having rung the bells: the last stretch of the road
  const watch = () => {
    if (valley.opened("lisiere") || valley.solves("clocher") < SOLVES_TO_OPEN_LISIERE) return;
    if (!valley.open("lisiere")) return;
    setTimeout(() => sfx.chime(), 400);
    setTimeout(() => setHint(...say.lisiere.opensHint), 800);
    announce(say.lisiere.opens);
  };
  valley.watch(watch);
  watch();
};

/* ---- per-frame -------------------------------------------------------- */
const frame = (dt, t) => {
  // the fox's tail, and nothing else about him: he watches and never moves in
  game.fox.style.setProperty("--sway", `${(Math.sin(t * 1.3) * 5).toFixed(1)}deg`);
  if (!REDUCED && state.mood > 0.5 && Math.random() < dt * 1.1) sparkle(rand(150, 250), rand(150, 250));
  draw();
};

const ways = {};

const place = {
  id: "lisiere",
  mode: "edge",
  road: 5,
  label: ["la lisière", "the wood's edge"],
  doorway: (dir) => ways.out.doorAt(dir),
  peek: (on) => scene.peek(on),
  standsAt: () => [isoX(...HIS), isoY(HIS[0], HIS[1], GROUND)],
  frame,
  wake, leave, sleep, land,
  enter, exit,
  // a tap on him calls the dog over, which is the one thing he could be asking for
  tapSheep: () => touchDog(),
};

enrol(place);
export default place;
