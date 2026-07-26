// La grange — the second place, and the one that proves a place is cheap.
//
// The bales ARE the fleeces the player has sheared: the barn opens on the third
// one, and what is stacked here is what came off his back. That is the whole
// design of the place — the care loop's output is the puzzle's material, so the
// puzzle cannot feel bolted on.
//
// Nuage is not a piece here, he is the crane: the only thing that can lift a
// bale, carrying exactly one at a time, walking it from post to post. The rule
// that a big bale may not sit on a small one needs no explaining in a barn.
import { $, el } from "../engine/svg.js";
import { rand, now, REDUCED } from "../engine/math.js";
import { springs, S, set, v, kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { sparkle, tuft } from "../engine/particles.js";
import { isoX, isoY, pt, poly, boxAt } from "../engine/iso.js";
import { state } from "../state.js";
import { announce, setHint } from "../ui/hint.js";
import { measureUI } from "../ui/hud.js";
import { refreshCTM, poke } from "../world/pointer.js";
import { unhost } from "../world/host.js";
import { panTo } from "../engine/camera.js";
import { dropShears } from "../world/wool.js";
import { cancelDrag } from "../world/clovers.js";
import { release } from "../world/hands.js";
import * as valley from "../world/valley.js";
import { HOME } from "../engine/save.js";
import { POSTS, BALES, OPTIMAL, start, top, refuses, solved } from "../puzzles/meules.js";
import { mount, unmount } from "./registry.js";
import { dioramaFor } from "./diorama.js";

const stage = $("#stage");
const barnMoves = $("#barnMoves");

// frame 1 of the filmstrip: one pitch east of la rivière
const scene = dioramaFor("grange", 1);
const { decor, layers } = scene;

// The posts sit on a diagonal rather than a row, which is what keeps the
// painter order live in here: standing at the near post, the far two are behind
// him and the near one in front, and walking re-files all three.
const POST = [[1.6, 3.4], [4.4, 2.2], [7.2, 1.0]];
const STAND = [[1.6, 4.5], [4.4, 3.3], [7.2, 2.1]];   // where he stands to work a post
const POST_H = 2.3;          // tiles: tall enough to show above a full stack
const BALE_H = 0.58;         // tiles per bale, so three of them clear the peg
const BALE_W = [1.15, 1.62, 2.10];
const NAME = ["le petit ballot", "le ballot moyen", "le gros ballot"];
const WHERE = ["premier pieu", "deuxième pieu", "troisième pieu"];

const game = {
  on: false, built: false, phase: "idle", at: 1,
  stacks: start(), carrying: null, moves: 0, stack: [], bales: [],
};

S("baleY", 0, 150, 12);   // the lift, when a bale comes up onto his back
S("walk", 1, 46, 13.6);   // which post he is standing at, as a continuous number

const postOf = (bale) => game.stacks.findIndex((s) => s.includes(bale));
const heightOf = (bale) => {
  const stack = game.stacks[postOf(bale)];
  return stack.indexOf(bale);
};

/** Where he is standing, between posts while he walks. */
const hisSpot = () => {
  const w = Math.max(0, Math.min(POSTS - 1, v("walk")));
  const i = Math.floor(w), f = w - i;
  const a = STAND[i], b = STAND[Math.min(POSTS - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
};
const hisDepth = () => { const [gx, gy] = hisSpot(); return gx + gy; };

const baleSpot = (bale) => {
  if (game.carrying === bale) {
    const [gx, gy] = hisSpot();
    // riding on his back: a bale carried is a bale above his shoulders
    return [isoX(gx, gy), isoY(gx, gy, 1) - 74 + v("baleY")];
  }
  const [gx, gy] = POST[postOf(bale)];
  return [isoX(gx, gy), isoY(gx, gy, heightOf(bale) * BALE_H)];
};
const baleDepth = (bale) => {
  // a carried bale reports HIS depth, and depth.js files an equal depth in
  // front — so it paints over his back with no special case at all
  if (game.carrying === bale) return hisDepth();
  const [gx, gy] = POST[postOf(bale)];
  return gx + gy;
};

/* ---- world building ---- */
const buildWorld = () => {
  if (game.built) return;
  game.built = true;

  // the plank floor, and the two walls that meet at the back corner
  boxAt(decor, -0.6, -0.6, 9.4, 5.4, 0, 0.35, "var(--iso-plank)", "var(--iso-plank-l)", "var(--iso-plank-r)");
  poly(decor, [pt(-0.6, -0.6, 0.35), pt(8.8, -0.6, 0.35), pt(8.8, -0.6, 3.6), pt(-0.6, -0.6, 3.6)].join(" "), "var(--iso-barn)");
  poly(decor, [pt(-0.6, -0.6, 0.35), pt(-0.6, 4.8, 0.35), pt(-0.6, 4.8, 3.6), pt(-0.6, -0.6, 3.6)].join(" "), "var(--iso-barn-l)");

  // the beams: three uprights along the back wall and the tie across them
  for (const gx of [0.4, 4.0, 7.6]) {
    boxAt(decor, gx, -0.5, 0.26, 0.26, 0.35, 3.1, "var(--iso-wood)", "var(--iso-wood-l)", "var(--iso-wood-r)");
  }
  poly(decor, [pt(-0.4, -0.42, 3.0), pt(8.6, -0.42, 3.0), pt(8.6, -0.42, 3.25), pt(-0.4, -0.42, 3.25)].join(" "), "var(--iso-wood-l)");

  // loose straw on the floor, so the barn is lived in rather than swept
  for (const i of [...Array(26).keys()]) {
    const gx = rand(-0.3, 8.6), gy = rand(-0.3, 4.6);
    const x = isoX(gx, gy), y = isoY(gx, gy, 0.35);
    const a = rand(-0.5, 0.5);
    decor.appendChild(el("line", {
      x1: (x - 7).toFixed(1), y1: (y - a * 4).toFixed(1),
      x2: (x + 7).toFixed(1), y2: (y + a * 4).toFixed(1),
      stroke: "var(--iso-straw)", "stroke-width": 2, "stroke-linecap": "round", opacity: ".7",
    }));
  }

  // the three posts
  for (const [i, [gx, gy]] of POST.entries()) {
    boxAt(decor, gx - 0.09, gy - 0.09, 0.18, 0.18, 0.35, POST_H,
      "var(--iso-wood)", "var(--iso-wood-l)", "var(--iso-wood-r)");
    const base = el("ellipse", {
      cx: isoX(gx, gy).toFixed(1), cy: isoY(gx, gy, 0.35).toFixed(1),
      rx: 26, ry: 13, fill: "#2c2318", opacity: ".16",
    });
    decor.appendChild(base);

    // the tap target for a post is a piece, not decor: it has to be reachable
    const hit = el("g", { id: `post${i}`, class: "post", tabindex: "0", role: "button" });
    hit.setAttribute("aria-label", `${WHERE[i]} — post ${i + 1}`);
    const px = isoX(gx, gy), py = isoY(gx, gy, 0.35);
    hit.appendChild(el("rect", {
      x: (px - 46).toFixed(1), y: (py - POST_H * 30 - 34).toFixed(1),
      width: 92, height: POST_H * 30 + 46, fill: "transparent",
    }));
    hit.appendChild(el("polygon", {
      class: "post__glow",
      points: [pt(gx - 0.42, gy - 0.42, 0.36), pt(gx + 0.42, gy - 0.42, 0.36),
        pt(gx + 0.42, gy + 0.42, 0.36), pt(gx - 0.42, gy + 0.42, 0.36)].join(" "),
      fill: "#fff6cd",
    }));
    layers.add(hit, () => gx + gy, `post${i}`);
    hit.addEventListener("pointerdown", (e) => { e.stopPropagation(); touchPost(i); });
    hit.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); touchPost(i); }
    });
    game.posts = game.posts ?? [];
    game.posts.push(hit);
  }

  // the bales, biggest first so the small one is drawn over it when stacked
  for (const size of [...Array(BALES).keys()]) {
    const w = BALE_W[size], node = el("g", { class: "bale", "data-bale": String(size) });
    const ax = w * 23, ay = w * 11.5, hz = BALE_H * 30;   // half-diagonals of the footprint
    node.appendChild(el("ellipse", { cx: 0, cy: 0, rx: ax * 0.95, ry: ay * 0.95, fill: "#2c2318", opacity: ".2" }));
    node.appendChild(el("polygon", { points: `${-ax},${-hz} 0,${-hz + ay} ${ax},${-hz} 0,${-hz - ay}`, fill: "var(--iso-hay)" }));
    node.appendChild(el("polygon", { points: `${-ax},${-hz} 0,${-hz + ay} 0,${ay} ${-ax},0`, fill: "var(--iso-hay-l)" }));
    node.appendChild(el("polygon", { points: `${ax},${-hz} 0,${-hz + ay} 0,${ay} ${ax},0`, fill: "var(--iso-hay-r)" }));
    // two twine bands, the thing that makes it read as a bale and not a crate
    for (const t of [-0.42, 0.42]) {
      node.appendChild(el("polyline", {
        points: `${ax * t - ax * 0.02},${-hz + ay * t + ay * 0.5} ${ax * t},${-hz + ay * t} ${ax * t + ax * 0.5},${-hz + ay * t + ay * 0.5}`,
        stroke: "var(--iso-twine)", "stroke-width": 2.6, fill: "none",
      }));
    }
    layers.add(node, () => baleDepth(size), `bale${size}`);
    game.bales.push(node);
  }
};

/* ---- drawing ---- */
const draw = () => {
  for (const size of [...Array(BALES).keys()]) {
    const [x, y] = baleSpot(size);
    game.bales[size].setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    // a carried bale is over a post without being on it — worth saying out loud,
    // because from the outside its position alone cannot tell you which
    game.bales[size].classList.toggle("carried", game.carrying === size);
  }
  const [gx, gy] = hisSpot();
  scene.host(isoX(gx, gy), isoY(gx, gy, 1));
  layers.sort(hisDepth());
};

/* ---- what the barn says about itself ---- */
const readout = () => {
  const list = game.stacks.map((stack, i) =>
    `${WHERE[i]} : ${stack.length ? stack.map((b) => NAME[b]).reverse().join(" sur ") : "vide"}`).join(". ");
  const held = game.carrying !== null ? ` Il porte ${NAME[game.carrying]}.` : "";
  announce(`${list}.${held}`);
};

const setMoves = () => {
  barnMoves.textContent = `${game.moves} ballot${game.moves > 1 ? "s" : ""} déplacé${game.moves > 1 ? "s" : ""}`;
  $("#barnUndo").disabled = game.stack.length === 0;
};

const syncPosts = () => {
  for (const [i, node] of game.posts.entries()) {
    const reachable = game.phase === "idle";
    node.toggleAttribute("disabled", !reachable);
    node.setAttribute("tabindex", reachable ? "0" : "-1");
    node.classList.toggle("open", reachable && game.carrying !== null && !refuses(game.stacks, i, game.carrying));
  }
};

/* ---- moves ---- */
const touchPost = (post) => {
  if (!game.on || game.phase !== "idle") return;
  poke();
  set("walk", post);
  game.at = post;

  if (game.carrying === null) {
    const bale = top(game.stacks, post);
    if (bale === null) {
      sfx.whiff();
      setHint("Ce pieu est vide", "that post is empty");
      return;
    }
    game.stack.push({ stacks: game.stacks.map((s) => [...s]), carrying: null, moves: game.moves });
    game.stacks[post].pop();
    game.carrying = bale;
    kick("baleY", -260);
    kick("earL", -140); kick("earR", 140);
    sfx.flutter();
    draw(); syncPosts(); readout();
    return;
  }

  const why = refuses(game.stacks, post, game.carrying);
  if (why) {
    // never a loss, only a sentence: he simply will not put it there
    sfx.whiff();
    kick("sway", post < game.at ? 90 : -90);
    setHint("Un gros ballot écraserait le petit", "a big bale would flatten a small one");
    announce("Trop gros pour ce pieu : pose-le ailleurs.");
    return;
  }

  game.stacks[post].push(game.carrying);
  game.carrying = null;
  game.moves += 1;
  springs.baleY.v = springs.baleY.target = 0;
  sfx.munch();
  for (const i of [...Array(4).keys()]) setTimeout(() => tuft(rand(170, 230), rand(210, 250)), i * 70);
  setMoves(); draw(); syncPosts();
  if (solved(game.stacks)) return win();
  readout();
};

const win = () => {
  game.phase = "won";
  syncPosts();
  sfx.chime();
  kick("hop", -300);
  for (const i of [...Array(18).keys()]) setTimeout(() => sparkle(rand(140, 260), rand(170, 250)), 420 + i * 40);
  setTimeout(() => sfx.bleat(state.mood > 0.5), 900);
  valley.solve("grange");
  const best = game.moves === OPTIMAL ? " C'est la solution optimale." : "";
  announce(`Les trois ballots sont sur le dernier pieu, en ${game.moves} déplacements.${best}`);
  setHint(`Rangé en ${game.moves} déplacements${game.moves === OPTIMAL ? ", le minimum" : ""}`,
    `stacked in ${game.moves}${game.moves === OPTIMAL ? " — the minimum" : ""}`);
};

const undo = () => {
  if (!game.on || !game.stack.length) return;
  const prev = game.stack.pop();
  game.stacks = prev.stacks.map((s) => [...s]);
  game.carrying = prev.carrying;
  game.moves = prev.moves;
  game.phase = "idle";
  springs.baleY.v = springs.baleY.target = 0;
  setMoves(); draw(); syncPosts(); readout();
};

const resetBoard = (animate = true) => {
  game.stacks = start();
  game.carrying = null;
  game.moves = 0;
  game.stack = [];
  game.phase = "idle";
  game.at = 1;
  springs.walk.v = springs.walk.target = 1;
  springs.baleY.v = springs.baleY.target = 0;
  layers.reset();
  setMoves(); syncPosts(); draw(); measureUI();
  if (animate) readout();
};

/* ---- entering and leaving ---- */
export const enter = () => {
  if (game.on || !valley.opened("grange")) return;
  buildWorld();
  scene.show(true);
  game.on = true;
  game.phase = "idle";
  poke();
  mount(place);
  panTo(1, true);
  valley.arrive("grange");
  release();
  dropShears();
  cancelDrag();
  resetBoard(false);
  stage.classList.add("gliding");
  setTimeout(() => stage.classList.remove("gliding"), 1000);
  setHint("Empile les trois ballots sur le dernier pieu — jamais un gros sur un petit",
    "stack all three on the last post — never a big one on a small one");
  setTimeout(() => { refreshCTM(); draw(); measureUI(); }, 20);
  setTimeout(refreshCTM, 1000);
  readout();
};

export const exit = () => {
  if (!game.on) return;
  game.on = false;
  game.phase = "idle";
  unmount();
  unhost();
  valley.arrive(HOME);
  scene.show(false);
  stage.classList.remove("gliding");
  setTimeout(refreshCTM, 60);
  setTimeout(refreshCTM, 700);
  announce("Retour au pré.");
};

/* ---- bound at boot; the barn itself is not built until the first visit ---- */
export const build = () => {
  $("#barnUndo").addEventListener("click", undo);
  $("#barnReset").addEventListener("click", () => { resetBoard(); sfx.flutter(); });
  $("#barnExit").addEventListener("click", exit);

  addEventListener("keydown", (e) => {
    if (!game.on) return;
    if (e.key === "Escape") { exit(); return; }
    const k = e.key.toLowerCase();
    if (k === "r") { resetBoard(); return; }
    if ((e.key === "z" && (e.ctrlKey || e.metaKey)) || e.key === "Backspace") { e.preventDefault(); undo(); return; }
    if (["1", "2", "3"].includes(e.key)) { e.preventDefault(); touchPost(Number(e.key) - 1); }
  });
};

const frame = (dt, t) => {
  // dust in the light from the loft, and only when he is happy enough to see it
  if (!REDUCED && state.mood > 0.5 && Math.random() < dt * 1.6) sparkle(rand(150, 250), rand(150, 260));
  draw();
};

const place = {
  id: "grange",
  mode: "barn",
  frame,
  tapSheep: () => touchPost(game.at),
};
