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
import { mount, unmount, enrol } from "./registry.js";
import { dioramaFor } from "./diorama.js";
import { wayTo } from "./signpost.js";
import { go } from "./travel.js";

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
const FLOOR = 0.35;          // the plank floor's top: everything in here stands on it
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
    return [isoX(gx, gy), isoY(gx, gy, FLOOR) - 74 + v("baleY")];
  }
  const [gx, gy] = POST[postOf(bale)];
  return [isoX(gx, gy), isoY(gx, gy, FLOOR + heightOf(bale) * BALE_H)];
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

  // The barn is drawn as a cutaway: back wall, back roof slope and the ridge,
  // with the near half left off so you can see in. That is the diorama
  // convention, and it is also why the sky is allowed to be behind it.
  const W = 8.8, D = 4.8;                 // the floor's far corner, in tiles
  const WALL = 3.4, RIDGE = 4.9;          // wall top and ridge height

  boxAt(decor, -0.6, -0.6, 9.4, 5.4, 0, FLOOR, "var(--iso-plank)", "var(--iso-plank-l)", "var(--iso-plank-r)");

  // the two walls that meet at the back corner
  poly(decor, [pt(-0.6, -0.6, FLOOR), pt(W, -0.6, FLOOR), pt(W, -0.6, WALL), pt(-0.6, -0.6, WALL)].join(" "), "var(--iso-barn)");
  poly(decor, [pt(-0.6, -0.6, FLOOR), pt(-0.6, D, FLOOR), pt(-0.6, D, WALL), pt(-0.6, -0.6, WALL)].join(" "), "var(--iso-barn-l)");
  // the gable above the left wall, closing the end of the roof
  poly(decor, [pt(-0.6, -0.6, WALL), pt(-0.6, D, WALL), pt(-0.6, (D - 0.6) / 2, RIDGE)].join(" "), "var(--iso-barn-l)");

  // the back roof slope, seen from underneath, and the ridge beam it hangs from
  poly(decor, [pt(-0.9, -0.9, WALL - 0.1), pt(W + 0.3, -0.9, WALL - 0.1),
    pt(W + 0.3, (D - 0.6) / 2, RIDGE), pt(-0.9, (D - 0.6) / 2, RIDGE)].join(" "), "var(--iso-roof)");
  poly(decor, [pt(-0.9, (D - 0.6) / 2, RIDGE), pt(W + 0.3, (D - 0.6) / 2, RIDGE),
    pt(W + 0.3, (D - 0.6) / 2, RIDGE - 0.14), pt(-0.9, (D - 0.6) / 2, RIDGE - 0.14)].join(" "), "var(--iso-wood-r)");

  // rafters running down the slope, the detail that makes a roof read as built
  for (const gx of [0.2, 2.0, 3.8, 5.6, 7.4]) {
    poly(decor, [pt(gx, -0.85, WALL - 0.08), pt(gx + 0.16, -0.85, WALL - 0.08),
      pt(gx + 0.16, (D - 0.6) / 2, RIDGE - 0.06), pt(gx, (D - 0.6) / 2, RIDGE - 0.06)].join(" "), "var(--iso-wood-r)", 0.55);
  }

  // the posts that hold the wall up, and the tie beam across them
  for (const gx of [0.4, 4.0, 7.6]) {
    boxAt(decor, gx, -0.5, 0.26, 0.26, FLOOR, WALL - FLOOR, "var(--iso-wood)", "var(--iso-wood-l)", "var(--iso-wood-r)");
  }
  poly(decor, [pt(-0.4, -0.42, WALL - 0.4), pt(8.6, -0.42, WALL - 0.4),
    pt(8.6, -0.42, WALL - 0.15), pt(-0.4, -0.42, WALL - 0.15)].join(" "), "var(--iso-wood-l)");

  // a bale of the old crop stacked in the corner, and a fork left leaning
  boxAt(decor, 7.6, 0.1, 1.0, 0.7, FLOOR, 0.5, "var(--iso-hay)", "var(--iso-hay-l)", "var(--iso-hay-r)");
  boxAt(decor, 7.7, 0.2, 0.8, 0.6, FLOOR + 0.5, 0.45, "var(--iso-hay)", "var(--iso-hay-l)", "var(--iso-hay-r)");
  const fx = isoX(0.6, 1.5), fy = isoY(0.6, 1.5, FLOOR);
  const fork = el("g", { transform: `translate(${fx.toFixed(1)} ${fy.toFixed(1)}) rotate(-14)` });
  fork.appendChild(el("line", { x1: 0, y1: 0, x2: 0, y2: -66, stroke: "var(--iso-wood-r)", "stroke-width": 4, "stroke-linecap": "round" }));
  for (const dx of [-9, 0, 9]) {
    fork.appendChild(el("line", {
      x1: dx * 0.4, y1: -63, x2: dx * 0.8, y2: -82,
      stroke: "var(--iso-wood-l)", "stroke-width": 3, "stroke-linecap": "round",
    }));
  }
  decor.appendChild(fork);

  // loose straw on the floor, so the barn is lived in rather than swept
  for (const i of [...Array(26).keys()]) {
    const gx = rand(-0.3, 8.6), gy = rand(-0.3, 4.6);
    const x = isoX(gx, gy), y = isoY(gx, gy, FLOOR);
    const a = rand(-0.5, 0.5);
    decor.appendChild(el("line", {
      x1: (x - 7).toFixed(1), y1: (y - a * 4).toFixed(1),
      x2: (x + 7).toFixed(1), y2: (y + a * 4).toFixed(1),
      stroke: "var(--iso-straw)", "stroke-width": 2, "stroke-linecap": "round", opacity: ".7",
    }));
  }

  // the three posts
  for (const [i, [gx, gy]] of POST.entries()) {
    boxAt(decor, gx - 0.09, gy - 0.09, 0.18, 0.18, FLOOR, POST_H,
      "var(--iso-wood)", "var(--iso-wood-l)", "var(--iso-wood-r)");
    const base = el("ellipse", {
      cx: isoX(gx, gy).toFixed(1), cy: isoY(gx, gy, FLOOR).toFixed(1),
      rx: 26, ry: 13, fill: "#2c2318", opacity: ".16",
    });
    decor.appendChild(base);

    // the tap target for a post is a piece, not decor: it has to be reachable
    const hit = el("g", { id: `post${i}`, class: "post", tabindex: "0", role: "button" });
    hit.setAttribute("aria-label", `${WHERE[i]} — post ${i + 1}`);
    const px = isoX(gx, gy), py = isoY(gx, gy, FLOOR);
    hit.appendChild(el("rect", {
      x: (px - 46).toFixed(1), y: (py - POST_H * 30 - 34).toFixed(1),
      width: 92, height: POST_H * 30 + 46, fill: "transparent",
    }));
    hit.appendChild(el("polygon", {
      class: "post__glow",
      points: [pt(gx - 0.42, gy - 0.42, FLOOR + 0.01), pt(gx + 0.42, gy - 0.42, FLOOR + 0.01),
        pt(gx + 0.42, gy + 0.42, FLOOR + 0.01), pt(gx - 0.42, gy + 0.42, FLOOR + 0.01)].join(" "),
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

  // The bales. What makes a bale read as hay rather than as a crate is not its
  // shape — it is the cut ends catching the light on the sides, the straw
  // escaping the edges, and the twine biting into it. All three, cheaply.
  for (const size of [...Array(BALES).keys()]) {
    const w = BALE_W[size], node = el("g", { class: "bale", "data-bale": String(size) });
    const ax = w * 23, ay = w * 11.5, hz = BALE_H * 30;   // half-diagonals of the footprint
    node.appendChild(el("ellipse", { cx: 0, cy: 0, rx: ax * 0.95, ry: ay * 0.95, fill: "#2c2318", opacity: ".2" }));
    node.appendChild(el("polygon", { points: `${-ax},${-hz} 0,${-hz + ay} ${ax},${-hz} 0,${-hz - ay}`, fill: "var(--iso-hay)" }));
    node.appendChild(el("polygon", { points: `${-ax},${-hz} 0,${-hz + ay} 0,${ay} ${-ax},0`, fill: "var(--iso-hay-l)" }));
    node.appendChild(el("polygon", { points: `${ax},${-hz} 0,${-hz + ay} 0,${ay} ${ax},0`, fill: "var(--iso-hay-r)" }));

    // the cut ends: short strokes down each visible face, following its slope
    for (const [side, tint] of [[-1, "#8f7a4e"], [1, "#7a6640"]]) {
      for (const i of [...Array(7).keys()]) {
        const u = 0.12 + (i / 7) * 0.82;
        const x = side * (ax - u * ax), yTop = -hz + u * ay, h = hz * rand(0.42, 0.78);
        node.appendChild(el("line", {
          x1: x.toFixed(1), y1: (yTop + hz * 0.12).toFixed(1),
          x2: x.toFixed(1), y2: (yTop + hz * 0.12 + h).toFixed(1),
          stroke: tint, "stroke-width": 1.5, "stroke-linecap": "round", opacity: ".5",
        }));
      }
    }

    // straw escaping along the two top edges, which is what softens the silhouette
    for (const side of [-1, 1]) {
      for (const i of [...Array(6).keys()]) {
        const u = 0.1 + (i / 6) * 0.85;
        const x = side * (ax - u * ax), y = -hz + u * ay;
        const a = rand(-0.7, 0.7);
        node.appendChild(el("line", {
          x1: x.toFixed(1), y1: y.toFixed(1),
          x2: (x + side * rand(3, 7)).toFixed(1), y2: (y + a * 4 - 2).toFixed(1),
          stroke: "var(--iso-straw)", "stroke-width": 1.4, "stroke-linecap": "round", opacity: ".85",
        }));
      }
    }

    // two twine bands wrapping the near faces — the detail that says "baled"
    for (const u of [0.3, 0.72]) {
      for (const side of [-1, 1]) {
        const x = side * (ax - u * ax), yTop = -hz + u * ay;
        node.appendChild(el("line", {
          x1: x.toFixed(1), y1: yTop.toFixed(1), x2: x.toFixed(1), y2: (yTop + hz).toFixed(1),
          stroke: "var(--iso-twine)", "stroke-width": 2.2, "stroke-linecap": "round", opacity: ".8",
        }));
      }
      // and across the top, joining the two ends of the same band
      node.appendChild(el("line", {
        x1: (-(ax - u * ax)).toFixed(1), y1: (-hz + u * ay).toFixed(1),
        x2: (u * ax).toFixed(1), y2: (-hz + u * ay - ay).toFixed(1),
        stroke: "var(--iso-twine)", "stroke-width": 2, "stroke-linecap": "round", opacity: ".55",
      }));
    }

    layers.add(node, () => baleDepth(size), `bale${size}`);
    game.bales.push(node);
  }

  // the barn door, and the road back to the river
  ways.west = wayTo(scene, -0.8, 4.1, -1, RIVIERE, go);
  ways.west.sync();
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
  scene.host(isoX(gx, gy), isoY(gx, gy, FLOOR));
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

/* ---- the three beats of arriving somewhere ---- */
const wake = () => { buildWorld(); scene.show(true); };
const sleep = () => { scene.show(false); game.on = false; };
const land = () => {
  game.on = true;
  ways.west?.sync();
  setMoves(); syncPosts(); draw(); measureUI();
  setHint("Empile les trois ballots sur le dernier pieu — jamais un gros sur un petit",
    "stack all three on the last post — never a big one on a small one");
  setTimeout(() => { refreshCTM(); draw(); measureUI(); }, 20);
  setTimeout(refreshCTM, 1000);
  readout();
};

/* ---- entering and leaving ---- */
export const enter = () => {
  if (game.on || !valley.opened("grange")) return;
  wake();
  poke();
  mount(place);
  panTo(1, true);
  valley.arrive("grange");
  release();
  dropShears();
  cancelDrag();
  if (!game.seen) { game.seen = true; resetBoard(false); }
  land();
  stage.classList.add("gliding");
  setTimeout(() => stage.classList.remove("gliding"), 1000);
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

const ways = {};
const RIVIERE = { id: "riviere", label: ["la rivière", "the river"] };

const place = {
  id: "grange",
  mode: "barn",
  road: 1,
  label: ["la grange", "the barn"],
  doorway: () => [isoX(-0.8, 4.1), isoY(-0.8, 4.1, FLOOR)],
  frame,
  wake, sleep, land,
  enter, exit,
  tapSheep: () => touchPost(game.at),
};

enrol(place);
export default place;
