// La rivière — the first place he walks into.
//
// The crossing borrows the sheep and nothing else. It never calls goHappy() or
// feed(), never writes state.happyUntil, and never touches state.cuddle: the
// cuddle rig stays live throughout, so you can stroke him on the bank between
// moves, and the world greys out around the river if his five minutes run out
// mid-crossing.
//
// Made things are faceted here, living things are rounded — the one rule that
// keeps a hand-built diorama coherent.
import { $, el } from "../engine/svg.js";
import { say } from "../ui/copy.js";
import { rand, now, REDUCED } from "../engine/math.js";
import { springs, S, set, v, kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { crumb, sparkle } from "../engine/particles.js";
import { isoX, isoY, pt, poly, boxAt, pine } from "../engine/iso.js";
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
import { PIECES, OPTIMAL, unsafe, solved } from "../puzzles/traversee.js";
import { history, fanfare } from "../puzzles/board.js";
import { mount, unmount, enrol } from "./registry.js";
import { dioramaFor } from "./diorama.js";
import * as neighbours from "./neighbours.js";
import { edges } from "./edges.js";
import { go } from "./travel.js";

const stage = $("#stage");
const crossMoves = $("#crossMoves");

// frame 0 of the filmstrip: la rivière is where the road starts, so every
// coordinate below is authored from tile zero and shifted by nobody
const scene = dioramaFor("riviere", 0);
const { decor, layers } = scene;

const SLOTS = {
  L: { loup: [2.6, 0.4], mouton: [1.4, 2.2], chou: [0.4, 4.0] },
  R: { loup: [8.6, 0.4], mouton: [7.4, 2.2], chou: [6.4, 4.0] },
};
const DOCK = { L: 3.85, R: 5.25 }, BOAT_GY = 2.5, BOAT_GZ = 0.3;
const NAME = { loup: "le loup", mouton: "Nuage", chou: "le chou" };
const SIDE_FR = { L: "rive gauche", R: "rive droite" };
const CARGO = ["loup", "chou"];   // the two he can carry; the third is himself

const past = history();

const game = {
  on: false, built: false, phase: "idle", rowTimer: 0, pose: {},
  boat: "L", where: { loup: "L", mouton: "L", chou: "L" },
  aboard: null, moves: 0, rowUntil: 0, rowing: 0, shake: 0,
};

S("boatX", DOCK.L, 34, 11);
S("cargoY", 0, 190, 13);

/* ---- world building ---- */

const crests = [];
const buildWorld = () => {
  if (game.built) return;
  game.built = true;

  // river bed and water, the one place a stretched quad is honest
  poly(decor, [pt(3, 0, 0.35), pt(6, 0, 0.35), pt(6, 5, 0.35), pt(3, 5, 0.35)].join(" "), "var(--iso-water)");
  poly(decor, [pt(3, 0, 0.35), pt(3, 5, 0.35), pt(3, 5, 0), pt(3, 0, 0)].join(" "), "var(--iso-water-d)");

  for (const i of [...Array(14).keys()]) {
    const node = poly(decor, "", "var(--iso-crest)", 0.55);
    crests.push({ node, wx: 3.15 + (i % 7) * 0.45, wy: (i * 0.71) % 5, phase: rand(0, 6.28) });
  }

  boxAt(decor, 0, 0, 3, 5, 0, 1, "var(--iso-grass)", "var(--iso-grass-l)", "var(--iso-earth-r)");
  boxAt(decor, 6, 0, 3, 5, 0, 1, "var(--iso-grass)", "var(--iso-grass-l)", "var(--iso-grass-r)");
  // the cliff faces that meet the water
  poly(decor, [pt(3, 0, 1), pt(3, 5, 1), pt(3, 5, 0), pt(3, 0, 0)].join(" "), "var(--iso-earth-r)");
  poly(decor, [pt(6, 0, 1), pt(6, 0, 0), pt(6, 5, 0), pt(6, 5, 1)].join(" "), "var(--iso-earth)", 0);

  // docks
  boxAt(decor, 2.7, 2.1, 0.5, 0.8, 1, 0.06, "var(--iso-wood)", "var(--iso-wood-l)", "var(--iso-wood-r)");
  boxAt(decor, 5.9, 2.1, 0.5, 0.8, 1, 0.06, "var(--iso-wood)", "var(--iso-wood-l)", "var(--iso-wood-r)");

  // scenery: nothing on the right bank nearer than gx+gy = 9, or it would
  // paint over Nuage, who is a single DOM actor sitting above this layer
  for (const [gx, gy, k] of [[0.4, 0.4, 1.15], [2.6, 0.5, 0.9], [0.5, 4.2, 1.05], [1.2, 3.0, 0.8]]) pine(decor, gx, gy, k);
  for (const [gx, gy, k] of [[8.4, 0.5, 1.1], [8.7, 0.2, 0.85], [6.3, 0.2, 0.95]]) pine(decor, gx, gy, k);

  // pennant post on the far bank, unfurled on a win
  const postX = isoX(8.75, 4.8), postY = isoY(8.75, 4.8, 1);
  const post = el("g", { transform: `translate(${postX.toFixed(1)} ${postY.toFixed(1)})` });
  post.appendChild(el("ellipse", { cx: 0, cy: 0, rx: 9, ry: 4, fill: "#2c3a2e", opacity: ".18" }));
  post.appendChild(el("polygon", { points: "-9,0 9,0 6,-7 -6,-7", fill: "var(--iso-earth-l)" }));
  post.appendChild(el("rect", { x: -2, y: -58, width: 4, height: 54, rx: 2, fill: "var(--iso-wood-r)" }));
  const flag = el("polygon", { class: "pennant", id: "pennant", points: "2,-57 33,-47 2,-37", fill: "#ff9ec4" });
  post.appendChild(flag);
  game.pennant = flag;
  decor.appendChild(post);

  /* ---- the boat: faceted hull, and oars that actually pull ---- */
  const boat = el("g", { id: "boat", tabindex: "0", role: "button" });
  boat.setAttribute("aria-label", "Traverser la rivière — row across");
  const hull = el("g", { transform: "scale(1.15)" });
  hull.appendChild(el("ellipse", { cx: 0, cy: 14, rx: 46, ry: 11, fill: "#1d3348", opacity: ".2" }));
  hull.appendChild(el("polygon", { points: "-26.9,-20.7 -11.5,-22.9 10.4,-15.5 28.0,-4.3 26.0,5.8 23.1,9.2 6.9,9.1 -12.4,1.1 -26.2,-8.3 -23.8,-14.3", fill: "var(--iso-wood-r)" }));
  hull.appendChild(el("polygon", { points: "5.8,8.6 -19.0,-1.1 -35.4,-13.3 -29.9,-22.2 -28.1,-15.0 -32.8,-6.9 -17.3,4.5 6.0,13.6", fill: "var(--iso-wood-l)" }));
  hull.appendChild(el("polygon", { points: "31.6,-4.3 28.9,7.3 5.8,8.6 6.0,13.6 27.2,12.6 29.2,2.0", fill: "var(--iso-wood-r)" }));
  hull.appendChild(el("path", {
    d: "M28.9,7.3 5.8,8.6 -19.0,-1.1 -35.4,-13.3 -29.9,-22.2 -12.2,-24.9 12.2,-16.7 31.6,-4.3Z M26.0,5.8 5.7,6.8 -16.5,-2.0 -31.3,-12.9 -26.9,-20.7 -11.5,-22.9 10.4,-15.5 28.0,-4.3Z",
    fill: "var(--iso-wood)", "fill-rule": "evenodd",
  }));
  const oarNear = el("line", { id: "oarNear", x1: 6, y1: 2, x2: 34, y2: 22, stroke: "var(--iso-wood-l)", "stroke-width": 4.5, "stroke-linecap": "round" });
  const oarFar = el("line", { id: "oarFar", x1: -8, y1: -12, x2: -38, y2: -2, stroke: "var(--iso-wood-l)", "stroke-width": 4.5, "stroke-linecap": "round" });
  hull.appendChild(oarNear); hull.appendChild(oarFar);
  boat.appendChild(hull);
  layers.add(boat, () => v("boatX") + BOAT_GY, "boat");
  game.boatNode = boat; game.oarNear = oarNear; game.oarFar = oarFar;

  /* ---- the wolf: rounded, like every living thing in this app ---- */
  const wolf = el("g", { id: "tokLoup", class: "tok", tabindex: "0", role: "button" });
  wolf.setAttribute("aria-label", "Le loup — the wolf");
  wolf.innerHTML = `
    <ellipse cx="0" cy="2" rx="46" ry="12" fill="#1d2a22" opacity=".18"/>
    <path d="M40,-34 C62,-40 66,-60 54,-70 C58,-52 46,-46 36,-44 Z" fill="#7d879a"/>
    <rect x="-30" y="-30" width="13" height="32" rx="6.5" fill="#79839a"/>
    <rect x="17" y="-30" width="13" height="32" rx="6.5" fill="#79839a"/>
    <ellipse cx="0" cy="-44" rx="42" ry="32" fill="#8d97a8"/>
    <ellipse cx="0" cy="-36" rx="27" ry="21" fill="#c9d1dc"/>
    <path d="M-34,-96 L-40,-124 L-14,-108 Z" fill="#8d97a8"/>
    <path d="M34,-96 L40,-124 L14,-108 Z" fill="#8d97a8"/>
    <path d="M-31,-99 L-35,-116 L-18,-106 Z" fill="#d3a3a8"/>
    <path d="M31,-99 L35,-116 L18,-106 Z" fill="#d3a3a8"/>
    <ellipse cx="0" cy="-92" rx="36" ry="30" fill="#98a2b3"/>
    <ellipse cx="0" cy="-80" rx="19" ry="15" fill="#e2e7ee"/>
    <path d="M-6,-86 Q0,-90 6,-86 Q6,-80 0,-77 Q-6,-80 -6,-86 Z" fill="#4a4550"/>
    <path d="M-12,-74 Q0,-68 12,-74" stroke="#4a4550" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="-14" cy="-99" rx="7.5" ry="8" fill="#3b2f3f"/>
    <ellipse cx="14" cy="-99" rx="7.5" ry="8" fill="#3b2f3f"/>
    <circle cx="-16.4" cy="-102" r="2.6" fill="#fff"/>
    <circle cx="11.6" cy="-102" r="2.6" fill="#fff"/>
    <path d="M-24,-112 Q-14,-116 -6,-112" stroke="#6d7688" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M24,-112 Q14,-116 6,-112" stroke="#6d7688" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  layers.add(wolf, () => depthOf("loup"), "loup");

  /* ---- the cabbage ---- */
  const chou = el("g", { id: "tokChou", class: "tok", tabindex: "0", role: "button" });
  chou.setAttribute("aria-label", "Le chou — the cabbage");
  chou.innerHTML = `
    <ellipse cx="0" cy="2" rx="44" ry="12" fill="#1d2a22" opacity=".18"/>
    <path d="M-50,-4 C-66,-18 -60,-44 -38,-42 C-46,-30 -46,-16 -40,-4 Z" fill="#4a9942"/>
    <path d="M50,-4 C66,-18 60,-44 38,-42 C46,-30 46,-16 40,-4 Z" fill="#55a54c"/>
    <circle cx="0" cy="-46" r="45" fill="#8ecf6d"/>
    <path d="M-45,-46 A45,45 0 0,1 -6,-91 L0,-46 Z" fill="#a5dd82"/>
    <path d="M6,-91 A45,45 0 0,1 45,-46 L0,-46 Z" fill="#7bc25c"/>
    <path d="M-45,-46 A45,45 0 0,0 0,-1 L0,-46 Z" fill="#77bb5a" opacity=".55"/>
    <path d="M-19,-79 Q0,-68 19,-79" stroke="#5faa46" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    <path d="M-33,-60 Q0,-42 33,-60" stroke="#5faa46" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M-38,-34 Q0,-14 38,-34" stroke="#5faa46" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <ellipse cx="-16" cy="-68" rx="10" ry="6.5" fill="#c9 efa0" opacity="0"/>
    <ellipse cx="-16" cy="-68" rx="10" ry="6.5" fill="#c8efa2" opacity=".45"/>`;
  layers.add(chou, () => depthOf("chou"), "chou");
  game.tok = { loup: wolf, chou };
  for (const id of CARGO) bindTok(id);
  bindBoat();

  // the road east, out of the far corner of the right bank
  // exits are declared per place because the ground is not the same shape twice:
  // banks are gx 0..3 and 6..9, gy 0..5 — and the left one is crowded with slots
  ways.out = edges(scene, place, { z: 1, west: [1.9, 4.0], east: [7.8, 1.8], home: [8.3, 4.0] }, go, exit);
  ways.out.sync();
};

/* ---- placement: one rail for all three actors, so they never drift apart ---- */
const placeTok = (id, ux, uy, scale) => {
  game.tok[id].setAttribute("transform", `translate(${ux.toFixed(1)} ${uy.toFixed(1)}) scale(${scale})`);
};
const TOK_SCALE = { loup: 0.58, chou: 0.52 };
const boatSpot = (gx) => [isoX(gx, BOAT_GY), isoY(gx, BOAT_GY, BOAT_GZ)];
const depthOf = (id) => {
  if (game.where[id] === "boat") return v("boatX") + BOAT_GY;
  const [gx, gy] = SLOTS[game.where[id]][id];
  return gx + gy;
};
const spot = (id) => {
  if (game.where[id] === "boat") {
    const [x, y] = boatSpot(v("boatX"));
    return [x, y - 6 + v("cargoY")];
  }
  const [gx, gy] = SLOTS[game.where[id]][id];
  return [isoX(gx, gy), isoY(gx, gy, 1)];
};

const drawActors = () => {
  // a choreography may pin a piece somewhere the board model does not know about
  for (const id of CARGO) placeTok(id, ...(game.pose[id] ?? spot(id)), TOK_SCALE[id]);
  const [mx, my] = game.pose.mouton ?? spot("mouton");
  scene.host(mx, my);
  layers.sort(depthOf("mouton"));
};

/* ---- what the world says about itself ---- */
const readout = () => {
  const list = (bank) => PIECES.filter((id) => game.where[id] === bank).map((id) => NAME[id]).join(", ") || "personne";
  const cargo = game.aboard ? ` ${NAME[game.aboard]} est dans la barque.` : "";
  announce(say.riviere.banks(list("L"), list("R"), SIDE_FR[game.boat], cargo));
};
const setMoves = () => {
  crossMoves.textContent = `${game.moves} passage${game.moves > 1 ? "s" : ""}`;
  $("#crossUndo").disabled = past.depth === 0;
  $("#crossRow").disabled = game.phase !== "idle";
};
const syncTokens = () => {
  $("#crossRow").disabled = game.phase !== "idle";
  for (const id of CARGO) {
    const node = game.tok[id];
    const reachable = game.where[id] === game.boat || game.where[id] === "boat";
    node.toggleAttribute("disabled", !reachable || game.phase !== "idle");
    node.setAttribute("tabindex", reachable && game.phase === "idle" ? "0" : "-1");
  }
};

/* ---- the board, written down ---- */
const serialize = () => ({
  boat: game.boat, where: { ...game.where }, aboard: game.aboard,
  moves: game.moves, phase: game.phase === "rowing" ? "idle" : game.phase, past: past.all(),
});

/** Read a board back. Anything this build cannot make sense of is refused
 *  wholesale rather than half-applied — a half-restored board is a broken one,
 *  and a fresh crossing is a perfectly good thing to be given instead. */
const deserialize = (blob) => {
  if (!blob || typeof blob !== "object") return false;
  const where = blob.where;
  const legal = where && typeof where === "object"
    && PIECES.every((id) => ["L", "R", "boat"].includes(where[id]))
    && ["L", "R"].includes(blob.boat);
  if (!legal) return false;
  game.boat = blob.boat;
  game.where = { ...where };
  game.aboard = PIECES.find((id) => where[id] === "boat") ?? null;
  game.moves = Number.isFinite(blob.moves) && blob.moves >= 0 ? blob.moves : 0;
  game.phase = blob.phase === "won" || blob.phase === "failed" ? blob.phase : "idle";
  game.pose = {};
  past.load(blob.past);
  springs.boatX.target = springs.boatX.v = DOCK[game.boat];
  springs.cargoY.target = springs.cargoY.v = 0;
  return true;
};

const remember = () => valley.keep("riviere", serialize());

/* ---- the three beats of arriving somewhere ---- */

/** Drawn and on screen, but not yet his. Called before a pan starts, so the
 *  place is already there when the camera reaches it. */
const wake = () => { buildWorld(); scene.show(true); };

/** Out of the document. Everything it knows is kept: walk away mid-crossing and
 *  the boat is where you left it when you come back. */
/** He has set off. Nothing in flight may land on a board he has left. */
const leave = () => { clearTimeout(game.rowTimer); game.on = false; };
const sleep = () => { scene.show(false); game.on = false; };

/** His. Accepting input, and saying where everything is. */
const land = () => {
  game.on = true;
  neighbours.settle(place);   // and what can be seen of next door
  if (game.phase === "rowing") game.phase = "idle";   // a crossing cannot outlive a walk
  ways.out?.sync();
  setMoves(); syncTokens(); drawActors(); measureUI();
  setHint(...say.riviere.how);
  setTimeout(() => { refreshCTM(); drawActors(); measureUI(); }, 20);
  setTimeout(refreshCTM, 1000);
  readout();
};

/* ---- entering and leaving ---- */
export const enter = () => {
  if (game.on || !valley.opened("riviere")) return;
  wake();
  poke();
  mount(place);
  panTo(0, true);
  valley.arrive("riviere");
  release();
  dropShears();
  cancelDrag();
  if (!game.seen) { game.seen = true; if (!deserialize(valley.board("riviere"))) resetBoard(false); }
  land();
  stage.classList.add("gliding");
  setTimeout(() => stage.classList.remove("gliding"), 1000);
};

export const exit = () => {
  if (!game.on) return;
  clearTimeout(game.rowTimer);
  game.on = false;
  game.phase = "idle";
  unmount();
  unhost();
  valley.arrive(HOME);
  neighbours.clear();   // the neighbours go with him; nothing is left on screen
  stage.classList.remove("riding", "gliding");
  setTimeout(refreshCTM, 60);
  setTimeout(refreshCTM, 700);
  announce(say.road.home);
};

const resetBoard = (animate = true) => {
  clearTimeout(game.rowTimer);   // a crossing in flight must not land on a fresh board
  game.pose = {};
  game.boat = "L";
  game.where = { loup: "L", mouton: "L", chou: "L" };
  game.aboard = null;
  game.moves = 0;
  past.clear();
  game.phase = "idle";
  springs.boatX.target = springs.boatX.v = DOCK.L;
  springs.cargoY.target = springs.cargoY.v = 0;
  for (const id of CARGO) game.tok[id].classList.remove("gone");
  game.tok.chou.style.transform = "";
  layers.reset();
  game.pennant.classList.remove("up");
  setMoves(); syncTokens(); drawActors(); measureUI();
  remember();
  if (animate) { readout(); }
};

/* ---- moves ---- */
const embark = (id) => {
  if (!game.on || game.phase !== "idle") return;
  if (game.where[id] === "boat") {           // stepping back ashore
    game.where[id] = game.boat;
    game.aboard = null;
  } else if (game.where[id] === game.boat) { // boarding, one seat, a second click swaps
    if (game.aboard) game.where[game.aboard] = game.boat;
    game.where[id] = "boat";
    game.aboard = id;
    kick("cargoY", -260);
  } else return;
  poke();
  sfx.flutter();
  syncTokens(); drawActors(); readout(); remember();
};

const row = () => {
  if (!game.on || game.phase !== "idle" || now() < game.rowUntil) return;
  past.push({ boat: game.boat, where: { ...game.where }, moves: game.moves });
  const from = game.boat;
  game.boat = from === "L" ? "R" : "L";
  game.moves += 1;
  game.rowUntil = now() + (REDUCED ? 0.24 : 1.05);
  game.rowing = game.rowUntil;
  game.phase = "rowing";
  state.petting = false;
  if (game.where.mouton === "boat") stage.classList.add("riding");
  set("boatX", DOCK[game.boat]);
  if (REDUCED) springs.boatX.v = DOCK[game.boat];
  sfx.row();
  poke();
  setMoves(); syncTokens();
  remember();
  clearTimeout(game.rowTimer);
  game.rowTimer = setTimeout(() => arrive(from), (game.rowUntil - now()) * 1000);
};

const arrive = (from) => {
  if (!game.on) return;
  if (game.aboard) {                 // auto-disembark: a second click carries no decision
    game.where[game.aboard] = game.boat;
    game.aboard = null;
    springs.cargoY.v = springs.cargoY.target = 0;
  }
  stage.classList.remove("riding");
  game.phase = "idle";
  drawActors(); syncTokens(); setMoves();

  const bad = unsafe(game.where, from);   // the one call site
  if (bad) return fail(bad);
  if (solved(game.where)) return win();
  readout(); remember();                              // silence is the reward for a correct move
};

const fail = (pair) => {
  game.phase = "failed";
  syncTokens();
  if (pair.includes("loup")) {
    // the wolf commits an unauthorised cuddle and carries him off
    const [wx, wy] = spot("mouton");
    game.pose.loup = [wx - 26, wy];
    kick("earL", -320); kick("earR", 320);
    setTimeout(() => {
      if (game.phase !== "failed") return;   // reset or undo already moved on
      game.tok.loup.classList.add("gone");
      game.pose.loup = [wx - 40, wy - 18];
      game.pose.mouton = [wx + 6, wy - 18];
      for (const i of [...Array(3).keys()]) {
        setTimeout(() => {
          const [px, py] = spot("mouton");
          const puff = el("ellipse", { cx: px + rand(-30, 30), cy: py - rand(10, 40), rx: 16, ry: 11, fill: "#8b94a5", opacity: ".7" });
          scene.front.appendChild(puff);
          setTimeout(() => puff.remove(), 900);
        }, i * 120);
      }
    }, 700);
    sfx.bleat(false);
    announce(say.riviere.wolfAte);
    setHint(...say.riviere.wolfAteHint);
  } else {
    // entirely his own fault, and the funnier of the two
    state.chewUntil = now() + 2.1;   // borrowed ingredients, never feed() itself
    sfx.munch();
    for (const i of [...Array(10).keys()]) setTimeout(() => crumb(200 + rand(-16, 16), 206), i * 60);
    game.tok.chou.classList.add("gone");
    announce(say.riviere.sheepAte);
    setHint(...say.riviere.sheepAteHint);
  }
};

const win = () => {
  game.phase = "won";
  syncTokens();
  fanfare("riviere");
  setTimeout(() => game.pennant.classList.add("up"), 700);
  const best = game.moves === OPTIMAL ? " C'est la solution optimale." : "";
  announce(say.riviere.won(game.moves, best));
  setHint(...say.riviere.wonHint(game.moves, game.moves === OPTIMAL));
};

const undo = () => {
  if (!game.on || !past.depth || game.phase === "rowing") return;
  clearTimeout(game.rowTimer);
  game.pose = {};
  const prev = past.pop();
  game.boat = prev.boat;
  game.where = { ...prev.where };
  game.moves = prev.moves;
  game.aboard = Object.keys(game.where).find((id) => game.where[id] === "boat") || null;
  game.phase = "idle";
  springs.boatX.target = DOCK[game.boat];
  if (REDUCED) springs.boatX.v = DOCK[game.boat];
  for (const id of CARGO) game.tok[id].classList.remove("gone");
  game.pennant.classList.remove("up");
  stage.classList.remove("riding");
  setMoves(); syncTokens(); drawActors(); readout(); remember();
};

/* ---- bindings ---- */
const bindTok = (id) => {
  const node = game.tok[id];
  node.addEventListener("pointerdown", (e) => { e.stopPropagation(); embark(id); });
  node.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); embark(id); }
  });
};
const bindBoat = () => {
  game.boatNode.addEventListener("pointerdown", (e) => { e.stopPropagation(); row(); });
  game.boatNode.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); row(); }
  });
};

/** Bound at boot; the diorama itself is not built until the first visit. */
export const build = () => {
  $("#crossRow").addEventListener("click", row);
  $("#crossUndo").addEventListener("click", undo);
  $("#crossReset").addEventListener("click", () => { resetBoard(); sfx.flutter(); });

  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "j") { game.on ? exit() : enter(); return; }
    if (!game.on) return;
    if (e.key === "Escape") { exit(); return; }
    if (k === "r") { resetBoard(); return; }
    if ((e.key === "z" && (e.ctrlKey || e.metaKey)) || e.key === "Backspace") { e.preventDefault(); undo(); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const wants = e.key === "ArrowRight" ? "L" : "R";
      if (game.boat === wants) row();
      else { game.shake = now() + 0.16; }     // wrong way: the hull just shrugs
    }
  });
};

/* ---- per-frame: crests, hull, oars, actors ---- */
const frame = (dt, t) => {
  const rowing = now() < game.rowing;

  for (const c of crests) {
    c.wy = (c.wy + 0.42 * dt) % 5;
    const z = 0.35 + Math.sin(t * 2.1 + c.phase) * 0.02;
    c.node.setAttribute("points", [
      pt(c.wx - 0.6, c.wy - 0.07, z), pt(c.wx + 0.6, c.wy - 0.07, z),
      pt(c.wx + 0.6, c.wy + 0.07, z), pt(c.wx - 0.6, c.wy + 0.07, z),
    ].join(" "));
  }

  const bob = Math.sin(t * (rowing ? 5.7 : 1.96)) * (rowing ? 4 : 2) - (rowing ? 4 : 0);
  const shake = now() < game.shake ? Math.sin(t * 90) * 4 : 0;
  const [bx, by] = boatSpot(v("boatX"));
  game.boatNode.setAttribute("transform", `translate(${(bx + shake).toFixed(1)} ${(by + bob).toFixed(1)})`);
  const stroke = rowing && !REDUCED ? Math.sin(t * 12) * 16 : 0;
  game.oarNear.setAttribute("transform", `rotate(${stroke.toFixed(1)} 6 2)`);
  game.oarFar.setAttribute("transform", `rotate(${stroke.toFixed(1)} -8 -12)`);

  drawActors();
};

/** The place, as the rest of the game sees it: an id for the save, a mode for
 *  the stylesheet, a frame, and what a tap on the sheep means while he is here. */
const ways = {};
// named lazily: the two places know each other, and a module cannot import a
// half-built neighbour at load time
const GRANGE = { id: "grange", label: ["la grange", "the barn"] };

const place = {
  id: "riviere",
  mode: "cross",
  road: 0,                                  // frame on the filmstrip
  label: ["la rivière", "the river"],
  doorway: (dir) => ways.out.doorAt(dir),
  peek: (on) => scene.peek(on),
  // where he ends up standing here, so a walk in or out starts and finishes on him
  standsAt: () => game.pose.mouton ?? spot("mouton"),
  frame,
  wake, leave, sleep, land,
  enter, exit,
  tapSheep: () => embark("mouton"),
};

enrol(place);
export default place;
