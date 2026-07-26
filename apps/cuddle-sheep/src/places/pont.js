// Le pont — a plank bridge over a cleft, one lantern, and four who have to be on
// the far side. The third place, and the one that answers whether a place is
// cheap: it needed no engine change and, unlike la grange, no door in the meadow
// either. The edges of the frame lead anywhere that is open, so a place further
// down the road opens onto the map for free. The cost went down, not up.
//
// It is dusk here whatever the hour, and it is dusk WITHOUT a grade. A multiply
// laid over the scene scales the distance between the happy palette and the sad
// one by the same factor it scales the palette — and that distance is the whole
// meaning of --m. So the dark comes from the place's own backdrop and its own
// mood-keyed palette: a cleft's sky is the opposite wall, not the sky. Every
// colour below still swings the full designed distance on his mood.
//
// Nuage is a walker here rather than the crane he is in the barn: he is the
// quickest of the four, which makes him the one who fetches the lantern back,
// and it means the board can be solved with him standing still on a ledge
// watching two lambs cross without him.
import { $, el } from "../engine/svg.js";
import { clamp, lerp, rand, now, REDUCED } from "../engine/math.js";
import { kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { sparkle } from "../engine/particles.js";
import { isoX, isoY, pt, poly, boxAt, pine } from "../engine/iso.js";
import { VB_X, VB_Y, VB_W, VB_H, panTo } from "../engine/camera.js";
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
import { SOLVES_TO_OPEN_PONT } from "../rules.js";
import { WALKERS, PACE, SEATS, OPTIMAL, start, cost, refuses, solved } from "../puzzles/pont.js";
import { history, fanfare } from "../puzzles/board.js";
import { mount, unmount, enrol } from "./registry.js";
import { dioramaFor } from "./diorama.js";
import { edges } from "./edges.js";
import { go } from "./travel.js";

const stage = $("#stage");
const bridgeMinutes = $("#bridgeMinutes");

// frame 2 of the filmstrip: one pitch east of la grange
const scene = dioramaFor("pont", 2);
const { decor, layers } = scene;

const LEDGE = 1;            // the top of both ledges: everything here stands on it
const SAG = 0.34;           // how far the middle of the deck hangs below its ends
const HEAD_L = 2.86, HEAD_R = 6.14;   // where the planks meet rock, either side
const SPAN_GY = 2.5;        // the bridge runs along this row

// Slots are a diagonal on each ledge rather than a row, which is what keeps the
// painter order live in here: whoever is nearest the camera changes as they move.
const SLOTS = {
  L: { nuage: [1.5, 3.7], vif: [2.3, 2.5], reveur: [1.4, 1.5], ainee: [0.5, 2.7] },
  R: { nuage: [7.5, 3.7], vif: [8.3, 2.5], reveur: [7.4, 1.5], ainee: [6.6, 2.7] },
};
const NAME = {
  nuage: "Nuage", vif: "l'agneau vif", reveur: "l'agneau rêveur", ainee: "la brebis aînée",
};
const EN = {
  nuage: "Nuage", vif: "the quick lamb", reveur: "the dreamy lamb", ainee: "the eldest ewe",
};
const SIDE_FR = { L: "ce côté-ci", R: "l'autre côté" };
const LAMBS = WALKERS.filter((w) => w !== "nuage");   // the three that are not him

const past = history();

const game = {
  on: false, built: false, phase: "idle", seen: false,
  where: start(), party: [], lantern: "L", minutes: 0,
  from: 0, until: 0, dir: 1, walking: [], tok: {},
};

/* ---- geometry ---------------------------------------------------------- */

/** The deck hangs. A rope bridge that does not sag is a footbridge, and a
 *  footbridge is not frightening enough to need a lantern. */
const deckZ = (gx) => {
  const u = clamp((gx - HEAD_L) / (HEAD_R - HEAD_L), 0, 1);
  return LEDGE - SAG * Math.sin(u * Math.PI);
};

/** How far through a crossing we are, eased so they set off and arrive gently
 *  rather than snapping into motion. */
const progress = () => {
  if (game.phase !== "crossing") return 1;
  const f = clamp((now() - game.from) / Math.max(0.05, game.until - game.from), 0, 1);
  return f * f * (3 - 2 * f);
};

/** Where a walker is, in tile space. On the bridge they are strung out along the
 *  span with a lateral offset each, so two crossing together never superimpose. */
const tileOf = (id) => {
  const at = game.walking.indexOf(id);
  if (at === -1) return SLOTS[game.where[id]][id];
  const f = progress();
  const gx = game.dir > 0 ? lerp(HEAD_L, HEAD_R, f) : lerp(HEAD_R, HEAD_L, f);
  // one leads and one follows, by a third of a tile along the planks
  const lead = at === 0 ? 0.17 : -0.17;
  return [gx + lead * game.dir, SPAN_GY + (game.walking.length > 1 ? (at === 0 ? -0.16 : 0.16) : 0)];
};

const spotOf = (id) => {
  const [gx, gy] = tileOf(id);
  const onBridge = game.walking.includes(id);
  return [isoX(gx, gy), isoY(gx, gy, onBridge ? deckZ(gx) : LEDGE)];
};
const depthOf = (id) => { const [gx, gy] = tileOf(id); return gx + gy; };

/** The lantern travels with whoever is carrying it, and otherwise waits at the
 *  head of the bridge on the side it was last set down. */
const lanternSpot = () => {
  if (game.walking.length) {
    const [gx, gy] = tileOf(game.walking[0]);
    return [isoX(gx, gy), isoY(gx, gy, deckZ(gx)) - 44];
  }
  const gx = game.lantern === "L" ? HEAD_L - 0.42 : HEAD_R + 0.42;
  return [isoX(gx, SPAN_GY + 0.5), isoY(gx, SPAN_GY + 0.5, LEDGE) - 8];
};

/* ---- the flock, drawn ---------------------------------------------------- */

/** One lamb: rounded, because everything alive in this app is rounded and
 *  everything built is faceted. The ear tag is the readable part — it carries the
 *  minutes, so the board needs no legend and no tooltip. */
const lambNode = (id, k, wool, edge) => {
  const g = el("g", { id: `tok-${id}`, class: "tok walker", tabindex: "0", role: "button" });
  g.setAttribute("aria-label", `${NAME[id]}, ${PACE[id]} minutes — ${EN[id]}`);
  const s = (n) => (n * k).toFixed(1);
  g.innerHTML = `
    <ellipse cx="0" cy="2" rx="${s(38)}" ry="${s(10)}" fill="#141c2a" opacity=".26"/>
    <line x1="${s(-13)}" y1="${s(-16)}" x2="${s(-15)}" y2="0" stroke="${edge}" stroke-width="${s(6)}" stroke-linecap="round"/>
    <line x1="${s(13)}" y1="${s(-16)}" x2="${s(15)}" y2="0" stroke="${edge}" stroke-width="${s(6)}" stroke-linecap="round"/>
    <g>
      <circle cx="${s(-16)}" cy="${s(-30)}" r="${s(16)}" fill="${edge}"/>
      <circle cx="${s(14)}" cy="${s(-32)}" r="${s(17)}" fill="${edge}"/>
      <circle cx="${s(-2)}" cy="${s(-40)}" r="${s(19)}" fill="${edge}"/>
      <circle cx="${s(-14)}" cy="${s(-31)}" r="${s(13)}" fill="${wool}"/>
      <circle cx="${s(13)}" cy="${s(-33)}" r="${s(14)}" fill="${wool}"/>
      <circle cx="${s(-2)}" cy="${s(-41)}" r="${s(16)}" fill="${wool}"/>
    </g>
    <ellipse cx="${s(26)}" cy="${s(-44)}" rx="${s(13)}" ry="${s(12)}" fill="var(--pont-face)"/>
    <ellipse cx="${s(29)}" cy="${s(-39)}" rx="${s(7)}" ry="${s(5.5)}" fill="var(--pont-muzzle)"/>
    <ellipse cx="${s(19)}" cy="${s(-53)}" rx="${s(8)}" ry="${s(4)}" fill="${edge}" transform="rotate(-24 ${s(19)} ${s(-53)})"/>
    <circle cx="${s(31)}" cy="${s(-47)}" r="${s(2.6)}" fill="#2f2733"/>
    <circle cx="${s(32)}" cy="${s(-48)}" r="${s(0.9)}" fill="#fff"/>
    <g class="walker__tag">
      <rect x="${s(11)}" y="${s(-58)}" width="${s(15)}" height="${s(11)}" rx="${s(3)}" fill="var(--pont-tag)"/>
      <text x="${s(18.5)}" y="${s(-49.6)}" text-anchor="middle" fill="var(--pont-tag-ink)"
            font-size="${s(9)}" font-family="var(--mono)" font-weight="500">${PACE[id]}</text>
    </g>`;
  return g;
};

/* ---- world building ---------------------------------------------------- */
const mists = [];
const buildWorld = () => {
  if (game.built) return;
  game.built = true;

  // The backdrop: the far wall of the cleft, exactly one frame wide. Wider and it
  // would paint over the neighbouring diorama during a walk between them, when
  // both bands are live at once — so the bound is the camera's own viewBox rather
  // than a number typed in twice.
  decor.appendChild(el("rect", {
    x: VB_X, y: VB_Y, width: VB_W, height: VB_H, fill: "var(--pont-sky)",
  }));
  // Three ridges darkening toward the near one. What is behind them is twilight
  // sky seen up between the walls, not a facing wall — which is what lets the far
  // end of the palette be luminous, and so lets his mood still swing in here.
  for (const [i, [y, h, fill]] of [[VB_Y, 210, "var(--pont-far)"],
    [VB_Y + 150, 190, "var(--pont-far-2)"], [VB_Y + 250, 250, "var(--pont-far-3)"]].entries()) {
    const step = 34 + i * 11;
    let d = `M${VB_X},${y + h}`;
    for (const k of [...Array(9).keys()]) {
      d += ` L${VB_X + k * (VB_W / 8)},${(y + Math.sin(k * 1.7 + i * 2.1) * step).toFixed(1)}`;
    }
    d += ` L${VB_X + VB_W},${y + h} Z`;
    decor.appendChild(el("path", { d, fill }));
  }

  // the depths, and the mist that says you cannot see the bottom
  poly(decor, [pt(HEAD_L, -1.2, LEDGE), pt(HEAD_R, -1.2, LEDGE),
    pt(HEAD_R, 6.4, LEDGE), pt(HEAD_L, 6.4, LEDGE)].join(" "), "var(--pont-deep)");
  for (const i of [...Array(7).keys()]) {
    const node = el("ellipse", {
      rx: rand(58, 104), ry: rand(9, 15), fill: "var(--pont-mist)", opacity: rand(0.16, 0.32).toFixed(2),
    });
    decor.appendChild(node);
    mists.push({ node, gx: rand(HEAD_L, HEAD_R), gy: rand(-0.6, 5.8), phase: rand(0, 6.28), z: rand(0.1, 0.72) });
  }

  // the two ledges, and the cliff faces that fall away into the cleft
  boxAt(decor, -0.9, -1.2, HEAD_L + 0.9, 7.6, 0, LEDGE,
    "var(--pont-rock)", "var(--pont-rock-l)", "var(--pont-rock-r)");
  boxAt(decor, HEAD_R, -1.2, 3.6, 7.6, 0, LEDGE,
    "var(--pont-rock)", "var(--pont-rock-l)", "var(--pont-rock-r)");
  poly(decor, [pt(HEAD_L, -1.2, LEDGE), pt(HEAD_L, 6.4, LEDGE),
    pt(HEAD_L, 6.4, 0), pt(HEAD_L, -1.2, 0)].join(" "), "var(--pont-rock-r)");

  // grass clinging to the rim, so the ledge reads as ground rather than as a slab
  for (const i of [...Array(30).keys()]) {
    const left = i % 2 === 0;
    const gx = left ? rand(-0.7, HEAD_L - 0.1) : rand(HEAD_R + 0.1, 9.4);
    const gy = rand(-1.0, 6.2);
    const x = isoX(gx, gy), y = isoY(gx, gy, LEDGE);
    decor.appendChild(el("path", {
      d: `M${x.toFixed(1)},${y.toFixed(1)} q${rand(-3, 3).toFixed(1)},-7 ${rand(-2, 2).toFixed(1)},-13`,
      stroke: "var(--pont-tuft)", "stroke-width": 2, fill: "none", "stroke-linecap": "round", opacity: ".8",
    }));
  }

  for (const [gx, gy, k] of [[-0.4, 4.8, 1.1], [0.2, 0.0, 0.85], [8.9, 0.2, 1.0], [9.2, 4.6, 0.9]]) {
    pine(decor, gx, gy, k);
  }

  /* ---- the bridge itself: two ropes, a deck of planks, and four anchor posts */
  for (const side of [HEAD_L, HEAD_R]) {
    for (const dy of [SPAN_GY - 0.62, SPAN_GY + 0.62]) {
      boxAt(decor, side - 0.11 + (side === HEAD_L ? -0.16 : 0.16), dy - 0.11, 0.22, 0.22, LEDGE, 1.15,
        "var(--pont-post)", "var(--pont-post-l)", "var(--pont-post-r)");
    }
  }
  // the handrails, sagging a little less than the deck does
  for (const dy of [SPAN_GY - 0.6, SPAN_GY + 0.6]) {
    for (const rail of [0, 1]) {
      const lift = rail ? 0.98 : 0.42;
      let d = "";
      for (const k of [...Array(19).keys()]) {
        const gx = lerp(HEAD_L, HEAD_R, k / 18);
        const z = deckZ(gx) * (rail ? 1 : 1) + lift - (rail ? SAG * 0.18 : 0);
        d += `${k ? " L" : "M"}${isoX(gx, dy).toFixed(1)},${isoY(gx, dy, z).toFixed(1)}`;
      }
      decor.appendChild(el("path", {
        d, stroke: "var(--pont-rope)", "stroke-width": rail ? 2.6 : 2, fill: "none", "stroke-linecap": "round",
      }));
    }
    // the verticals that tie rail to deck
    for (const k of [...Array(9).keys()]) {
      const gx = lerp(HEAD_L, HEAD_R, k / 8);
      const z = deckZ(gx);
      decor.appendChild(el("line", {
        x1: isoX(gx, dy).toFixed(1), y1: isoY(gx, dy, z + 0.98 - SAG * 0.18).toFixed(1),
        x2: isoX(gx, dy).toFixed(1), y2: isoY(gx, dy, z).toFixed(1),
        stroke: "var(--pont-rope)", "stroke-width": 1.4, opacity: ".72",
      }));
    }
  }
  // the planks: each one a small quad following the sag, which is what makes the
  // curve legible rather than merely present
  for (const k of [...Array(22).keys()]) {
    const a = lerp(HEAD_L, HEAD_R, k / 22), b = lerp(HEAD_L, HEAD_R, (k + 0.72) / 22);
    poly(decor, [pt(a, SPAN_GY - 0.58, deckZ(a)), pt(b, SPAN_GY - 0.58, deckZ(b)),
      pt(b, SPAN_GY + 0.58, deckZ(b)), pt(a, SPAN_GY + 0.58, deckZ(a))].join(" "),
    k % 2 ? "var(--pont-plank)" : "var(--pont-plank-2)");
  }

  /* ---- the lantern: the one piece that decides who may walk ---- */
  const lamp = el("g", { id: "lantern", class: "lantern", tabindex: "0", role: "button" });
  lamp.setAttribute("aria-label", "Traverser le pont — walk the bridge");
  lamp.innerHTML = `
    <circle class="lantern__glow" r="76" fill="var(--pont-lamp)" opacity=".10"/>
    <circle class="lantern__glow" r="46" fill="var(--pont-lamp)" opacity=".14"/>
    <circle class="lantern__glow" r="24" fill="var(--pont-lamp)" opacity=".22"/>
    <rect x="-15" y="-30" width="30" height="30" fill="transparent"/>
    <path d="M-5,-26 q5,-7 10,0" stroke="var(--pont-rope)" stroke-width="1.8" fill="none"/>
    <polygon points="-7,-22 7,-22 5,-19 -5,-19" fill="var(--pont-post-r)"/>
    <polygon points="-5,-19 5,-19 6,-4 -6,-4" fill="var(--pont-lamp)" opacity=".92"/>
    <polygon points="-6,-4 6,-4 8,-1 -8,-1" fill="var(--pont-post-r)"/>
    <line x1="0" y1="-18" x2="0" y2="-5" stroke="#fff6cd" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>`;
  layers.add(lamp, () => {
    if (game.walking.length) { const [gx, gy] = tileOf(game.walking[0]); return gx + gy; }
    return (game.lantern === "L" ? HEAD_L - 0.42 : HEAD_R + 0.42) + SPAN_GY + 0.5;
  }, "lantern");
  game.lamp = lamp;
  bindPiece(lamp, () => cross());

  /* ---- the three lambs ---- */
  const LOOK = {
    vif: [0.62, "var(--pont-fleece)", "var(--pont-fleece-edge)"],
    reveur: [0.7, "var(--pont-fleece)", "var(--pont-fleece-edge)"],
    ainee: [0.86, "var(--pont-ainee)", "var(--pont-ainee-edge)"],
  };
  for (const id of LAMBS) {
    const node = lambNode(id, ...LOOK[id]);
    layers.add(node, () => depthOf(id), id);
    game.tok[id] = node;
    bindPiece(node, () => join(id));
  }

  // the road on, out of the far corner of the right ledge
  // exits are declared per place because the ground is not the same shape twice:
  // two ledges, nothing in the middle
  ways.out = edges(scene, place, { z: LEDGE, west: [0.9, 3.0], east: [8.6, 2.5], home: [8.0, 5.4] }, go, exit);
  ways.out.sync();
};

const bindPiece = (node, act) => {
  node.addEventListener("pointerdown", (e) => { e.stopPropagation(); act(); });
  node.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); act(); }
  });
};

/* ---- drawing ---------------------------------------------------------- */
const draw = () => {
  for (const id of LAMBS) {
    const [x, y] = spotOf(id);
    game.tok[id].setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    game.tok[id].classList.toggle("chosen", game.party.includes(id));
  }
  const [lx, ly] = lanternSpot();
  game.lamp.setAttribute("transform", `translate(${lx.toFixed(1)} ${ly.toFixed(1)})`);

  const [hx, hy] = spotOf("nuage");
  scene.host(hx, hy);
  stage.classList.toggle("chosen", game.party.includes("nuage"));
  layers.sort(depthOf("nuage"));
};

/* ---- what the bridge says about itself -------------------------------- */
const readout = () => {
  const list = (side) => WALKERS.filter((w) => game.where[w] === side).map((w) => NAME[w]).join(", ") || "personne";
  const chosen = game.party.length
    ? ` Prêts à passer : ${game.party.map((w) => NAME[w]).join(" et ")}.`
    : " Personne n'est encore choisi.";
  announce(`De ce côté : ${list("L")}. De l'autre : ${list("R")}. La lanterne est de ${SIDE_FR[game.lantern]}.${chosen}`);
};

const setMinutes = () => {
  bridgeMinutes.textContent = `${game.minutes} minute${game.minutes > 1 ? "s" : ""}`;
  $("#bridgeUndo").disabled = past.depth === 0;
  $("#bridgeCross").disabled = game.phase !== "idle" || refuses(game.where, game.party, game.lantern) !== null;
};

/** A walker is reachable when they are on the lantern's side and nothing is in
 *  flight. Keys only ever open: nothing here is ever taken away mid-thought. */
const syncWalkers = () => {
  for (const id of LAMBS) {
    const node = game.tok[id];
    const reachable = game.phase === "idle" && game.where[id] === game.lantern;
    node.toggleAttribute("disabled", !reachable);
    node.setAttribute("tabindex", reachable ? "0" : "-1");
  }
  const ready = game.phase === "idle" && refuses(game.where, game.party, game.lantern) === null;
  game.lamp.classList.toggle("ready", ready);
  game.lamp.setAttribute("tabindex", game.phase === "idle" ? "0" : "-1");
  setMinutes();
};

/* ---- moves ------------------------------------------------------------ */

/** Take somebody along, or leave them behind. A third tap on a full party swaps
 *  out whoever was chosen first, so there is never a dead tap to explain. */
const join = (id) => {
  if (!game.on || game.phase !== "idle") return;
  if (game.where[id] !== game.lantern) {
    sfx.whiff();
    setHint(`${NAME[id]} est de l'autre côté`, `${EN[id]} is on the other side`);
    return;
  }
  poke();
  const at = game.party.indexOf(id);
  if (at !== -1) game.party.splice(at, 1);
  else {
    if (game.party.length >= SEATS) game.party.shift();
    game.party.push(id);
    kick("earL", -90); kick("earR", 90);
  }
  sfx.flutter();
  draw(); syncWalkers(); readout(); remember();
};

const cross = () => {
  if (!game.on || game.phase !== "idle") return;
  const why = refuses(game.where, game.party, game.lantern);
  if (why) {
    sfx.whiff();
    const said = why === "empty"
      ? ["Choisis qui porte la lanterne", "pick who carries the lantern"]
      : ["Les planches n'en portent que deux", "the planks take only two"];
    setHint(...said);
    announce(why === "empty"
      ? "Personne ne peut traverser sans la lanterne : choisis d'abord."
      : "Deux au plus sur les planches.");
    return;
  }

  past.push({
    where: { ...game.where }, lantern: game.lantern, minutes: game.minutes, party: [...game.party],
  });
  const spent = cost(game.party);
  game.minutes += spent;
  game.dir = game.lantern === "L" ? 1 : -1;
  game.walking = [...game.party].sort((a, b) => PACE[b] - PACE[a]);   // the slow one leads
  game.phase = "crossing";
  game.from = now();
  // a slow walker visibly plods: the animation lengthens with the pace it costs,
  // so the number on the ear tag and what you watch agree
  game.until = game.from + (REDUCED ? 0.14 : 0.62 + spent * 0.055);
  state.petting = false;
  sfx.row();
  poke();
  syncWalkers();
  if (REDUCED) land_arrive();
};

/** The party is across. Named apart from travel's arrive() on purpose — this one
 *  is a crossing of the bridge, not a journey between places. */
const land_arrive = () => {
  if (!game.on) return;
  const side = game.dir > 0 ? "R" : "L";
  for (const id of game.walking) game.where[id] = side;
  game.lantern = side;
  game.walking = [];
  game.party = [];
  game.phase = "idle";
  draw(); syncWalkers();
  if (solved(game.where)) return win();
  readout(); remember();          // silence is the reward for a sound crossing
};

const win = () => {
  game.phase = "won";
  syncWalkers();
  fanfare("pont");
  const best = game.minutes === OPTIMAL ? " C'est le minimum." : "";
  announce(`Tout le monde est passé en ${game.minutes} minutes.${best}`);
  setHint(`Tous passés en ${game.minutes} minutes${game.minutes === OPTIMAL ? ", le minimum" : ""}`,
    `all across in ${game.minutes} minutes${game.minutes === OPTIMAL ? " — the minimum" : ""}`);
};

const undo = () => {
  if (!game.on || !past.depth || game.phase === "crossing") return;
  const prev = past.pop();
  game.where = { ...prev.where };
  game.lantern = prev.lantern;
  game.minutes = prev.minutes;
  game.party = [...prev.party];
  game.walking = [];
  game.phase = "idle";
  draw(); syncWalkers(); readout(); remember();
};

const resetBoard = (animate = true) => {
  game.where = start();
  game.party = [];
  game.walking = [];
  game.lantern = "L";
  game.minutes = 0;
  game.phase = "idle";
  past.clear();
  layers.reset();
  draw(); syncWalkers(); measureUI();
  remember();
  if (animate) readout();
};

/* ---- the board, written down ------------------------------------------ */
const serialize = () => ({
  where: { ...game.where }, lantern: game.lantern, minutes: game.minutes,
  party: [...game.party], phase: game.phase === "crossing" ? "idle" : game.phase, past: past.all(),
});

/** Every walker on a known side, the lantern on one of the two, and no party
 *  larger than the planks — or the board is refused whole. A half-restored board
 *  is a broken one, and a fresh bridge is a perfectly good thing to be given. */
const deserialize = (blob) => {
  if (!blob || typeof blob !== "object") return false;
  const where = blob.where;
  if (!where || typeof where !== "object") return false;
  if (!WALKERS.every((w) => where[w] === "L" || where[w] === "R")) return false;
  if (blob.lantern !== "L" && blob.lantern !== "R") return false;
  const party = Array.isArray(blob.party) ? blob.party.filter((w) => WALKERS.includes(w)) : [];
  if (party.length > SEATS) return false;
  game.where = { ...where };
  game.lantern = blob.lantern;
  // a party that was chosen on the other side is not a party any more
  game.party = party.filter((w) => where[w] === blob.lantern);
  game.minutes = Number.isFinite(blob.minutes) && blob.minutes >= 0 ? blob.minutes : 0;
  game.phase = blob.phase === "won" ? "won" : "idle";
  game.walking = [];
  past.load(blob.past);
  return true;
};

const remember = () => valley.keep("pont", serialize());

/* ---- the three beats of arriving somewhere ---------------------------- */
const wake = () => { buildWorld(); scene.show(true); };
const leave = () => { game.on = false; };
const sleep = () => { scene.show(false); game.on = false; };
const land = () => {
  game.on = true;
  // a crossing cannot outlive a walk away from here: the party is put back on the
  // side it set off from rather than teleported across while nobody was looking
  if (game.phase === "crossing") { game.walking = []; game.phase = "idle"; }
  ways.out?.sync();
  draw(); syncWalkers(); measureUI();
  setHint("Deux au plus, et la lanterne va avec eux — on marche au pas du plus lent",
    "two at a time, and the lantern goes with them — you walk at the slower one's pace");
  setTimeout(() => { refreshCTM(); draw(); measureUI(); }, 20);
  setTimeout(refreshCTM, 1000);
  readout();
};

/* ---- entering and leaving --------------------------------------------- */
export const enter = () => {
  if (game.on || !valley.opened("pont")) return;
  wake();
  poke();
  mount(place);
  panTo(2, true);
  valley.arrive("pont");
  release();
  dropShears();
  cancelDrag();
  if (!game.seen) { game.seen = true; if (!deserialize(valley.board("pont"))) resetBoard(false); }
  land();
  stage.classList.add("gliding");
  setTimeout(() => stage.classList.remove("gliding"), 1000);
};

export const exit = () => {
  if (!game.on) return;
  game.on = false;
  game.phase = "idle";
  game.walking = [];
  unmount();
  unhost();
  valley.arrive(HOME);
  scene.show(false);
  stage.classList.remove("gliding", "chosen");
  setTimeout(refreshCTM, 60);
  setTimeout(refreshCTM, 700);
  announce("Retour au pré.");
};

/* ---- bound at boot; the cleft itself is not built until the first visit -- */
export const build = () => {
  $("#bridgeCross").addEventListener("click", cross);
  $("#bridgeUndo").addEventListener("click", undo);
  $("#bridgeReset").addEventListener("click", () => { resetBoard(); sfx.flutter(); });

  addEventListener("keydown", (e) => {
    if (!game.on) return;
    if (e.key === "Escape") { exit(); return; }
    const k = e.key.toLowerCase();
    if (k === "r") { resetBoard(); return; }
    if ((e.key === "z" && (e.ctrlKey || e.metaKey)) || e.key === "Backspace") { e.preventDefault(); undo(); return; }
    if (k === "c") { e.preventDefault(); cross(); return; }
    // 1..4 pick a walker, in the order they are named — Nuage first, because he
    // is the one you already know how to touch
    const n = ["1", "2", "3", "4"].indexOf(e.key);
    if (n !== -1) { e.preventDefault(); join(WALKERS[n]); }
  });

  // What opens the way here: having ferried a flock across water once already.
  // The frame's own edges do the rest — there is no door in the meadow for le pont,
  // because a place further down the road does not need one.
  const watch = () => {
    if (valley.opened("pont") || valley.solves("riviere") < SOLVES_TO_OPEN_PONT) return;
    if (!valley.open("pont")) return;
    setTimeout(() => sfx.chime(), 400);
    setTimeout(() => setHint("Une lanterne s'allume au bout de la vallée — le pont",
      "a lantern is lit down the valley — the bridge"), 800);
    announce("Le pont est ouvert, plus loin dans la vallée : suis le panneau.");
  };
  valley.watch(watch);
  watch();
};

/* ---- per-frame: the mist breathes, the lantern swings ------------------ */
const frame = (dt, t) => {
  for (const m of mists) {
    m.gy = (m.gy + 0.13 * dt) % 7 - 0.6;
    const z = m.z + Math.sin(t * 0.7 + m.phase) * 0.06;
    m.node.setAttribute("cx", isoX(m.gx, m.gy).toFixed(1));
    m.node.setAttribute("cy", isoY(m.gx, m.gy, z).toFixed(1));
  }
  // the lamp swings while it is being carried, and only then
  const swing = game.walking.length && !REDUCED ? Math.sin(t * 5.4) * 7 : 0;
  game.lamp.style.setProperty("--swing", `${swing.toFixed(1)}deg`);
  if (!REDUCED && game.walking.length && Math.random() < dt * 2.2) {
    const [lx, ly] = lanternSpot();
    sparkle(lx + rand(-9, 9), ly + rand(-6, 6));
  }
  if (game.phase === "crossing" && now() >= game.until) land_arrive();
  draw();
};

const ways = {};

const place = {
  id: "pont",
  mode: "bridge",
  road: 2,
  label: ["le pont", "the bridge"],
  doorway: (dir) => ways.out.doorAt(dir),
  frame,
  wake, leave, sleep, land,
  enter, exit,
  // a tap on him is him volunteering, which is the same as tapping any walker
  tapSheep: () => join("nuage"),
};

enrol(place);
export default place;
