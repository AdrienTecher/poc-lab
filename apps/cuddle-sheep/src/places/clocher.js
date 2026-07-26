// Le clocher — five bells, a phrase, and giving it back.
//
// This is the place that tested the seam rather than confirming it. The
// structural seam held completely: registry, diorama, depth, camera, travel,
// save and the signpost are all untouched, exactly as for la grange and le pont.
// But it needed one thing added to engine/audio.js — a bell voice that takes a
// pitch — because the synth had only fixed gestures and a fixed arpeggio cannot
// spell a phrase. That is a new capability in an engine-shaped library, not a
// repair to a seam that failed: no existing voice changed, and nothing else in
// the game noticed. Worth stating precisely, because "zero engine changes" is the
// bar and this is the first place to miss it.
//
// A mistake is a rewind here as everywhere: a wrong bell costs a replay and
// nothing else. The phrase never shortens, and the tally of replays only fills.
import { $, el } from "../engine/svg.js";
import { clamp, rand, now, REDUCED } from "../engine/math.js";
import { kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { sparkle } from "../engine/particles.js";
import { isoX, isoY, pt, poly, boxAt } from "../engine/iso.js";
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
import { SOLVES_TO_OPEN_CLOCHER } from "../rules.js";
import { BELLS, PITCH, LENGTH, judge, grow, solved } from "../puzzles/carillon.js";
import { fanfare } from "../puzzles/board.js";
import { mount, unmount, enrol } from "./registry.js";
import { dioramaFor } from "./diorama.js";
import { signpost } from "./signpost.js";
import { go } from "./travel.js";

const stage = $("#stage");
const bellRound = $("#bellRound");

// frame 3 of the filmstrip: one pitch east of le pont
const scene = dioramaFor("clocher", 3);
const { decor, layers } = scene;

const FLOOR = 0.3;
const BELFRY = 3.35;            // where the bells hang
const HAND = 1.02;              // where a rope ends up, at his height
const ROW_GY = 1.4;             // the bells and their ropes run along this row
const AT = [0.9, 2.2, 3.5, 4.8, 6.1];   // one gx per bell
const HIS = [3.5, 2.4];         // he stands among the ropes, not behind them
const BEAT = 0.62;              // seconds between two bells of a phrase

const NAME = { do: "do", re: "ré", mi: "mi", sol: "sol", la: "la" };

const game = {
  on: false, built: false, seen: false, phase: "idle",
  phrase: [], played: [], replays: 0, rounds: 0,
  swing: {}, ropes: {}, bells: {}, sungAt: 0, sungFor: 0,
};

/* ---- geometry ---------------------------------------------------------- */
const bellAt = (id) => AT[BELLS.indexOf(id)];

/** A struck bell rocks and settles. One decaying oscillation drives both the bell
 *  and the rope, so the two can never disagree about whether it is ringing. */
const rock = (id) => {
  const s = game.swing[id];
  if (!s) return 0;
  const age = now() - s.at;
  if (age > 2.4) return 0;
  return Math.sin(age * 7.4) * s.amp * Math.exp(-age * 1.7);
};

/* ---- world building ---------------------------------------------------- */
const buildWorld = () => {
  if (game.built) return;
  game.built = true;

  const W = 7.6, D = 4.4, WALL = 4.6;

  // the belfry, as a cutaway: back wall, left wall, and the floor he stands on.
  // Same convention as la grange — the near half is left off so you can see in.
  boxAt(decor, -0.6, -0.6, W + 0.6, D + 0.6, 0, FLOOR,
    "var(--clocher-floor)", "var(--clocher-floor-l)", "var(--clocher-floor-r)");
  poly(decor, [pt(-0.6, -0.6, FLOOR), pt(W, -0.6, FLOOR), pt(W, -0.6, WALL), pt(-0.6, -0.6, WALL)].join(" "),
    "var(--clocher-stone)");
  poly(decor, [pt(-0.6, -0.6, FLOOR), pt(-0.6, D, FLOOR), pt(-0.6, D, WALL), pt(-0.6, -0.6, WALL)].join(" "),
    "var(--clocher-stone-l)");

  // coursed stone: a few horizontal joints and staggered verticals, which is what
  // makes a flat fill read as masonry rather than as a wall of paint
  for (const z of [0.9, 1.6, 2.3, 3.0, 3.7, 4.4]) {
    decor.appendChild(el("line", {
      x1: isoX(-0.6, -0.6).toFixed(1), y1: isoY(-0.6, -0.6, z).toFixed(1),
      x2: isoX(W, -0.6).toFixed(1), y2: isoY(W, -0.6, z).toFixed(1),
      stroke: "var(--clocher-joint)", "stroke-width": 1.4, opacity: ".55",
    }));
    for (const gx of [0.4, 1.8, 3.2, 4.6, 6.0, 7.2]) {
      const jitter = ((z * 10 + gx) % 2 < 1) ? 0.6 : 0;
      decor.appendChild(el("line", {
        x1: isoX(gx + jitter, -0.6).toFixed(1), y1: isoY(gx + jitter, -0.6, z).toFixed(1),
        x2: isoX(gx + jitter, -0.6).toFixed(1), y2: isoY(gx + jitter, -0.6, z - 0.7).toFixed(1),
        stroke: "var(--clocher-joint)", "stroke-width": 1.2, opacity: ".4",
      }));
    }
  }

  // two arched openings, with the evening beyond them. They are the only light in
  // here, which is why the bronze catches it and the stone does not.
  for (const gx of [1.5, 5.2]) {
    const cx = isoX(gx, -0.6), top = isoY(gx, -0.6, 3.6), bot = isoY(gx, -0.6, 1.5);
    const w = 34;
    decor.appendChild(el("path", {
      d: `M${(cx - w).toFixed(1)},${bot.toFixed(1)} L${(cx - w).toFixed(1)},${(top + w).toFixed(1)} ` +
         `A${w},${w} 0 0 1 ${(cx + w).toFixed(1)},${(top + w).toFixed(1)} L${(cx + w).toFixed(1)},${bot.toFixed(1)} Z`,
      fill: "var(--clocher-sky)",
    }));
    // the reveal: the thickness of the wall, which is what gives an opening depth
    decor.appendChild(el("path", {
      d: `M${(cx - w).toFixed(1)},${bot.toFixed(1)} L${(cx - w).toFixed(1)},${(top + w).toFixed(1)} ` +
         `A${w},${w} 0 0 1 ${(cx + w).toFixed(1)},${(top + w).toFixed(1)} L${(cx + w).toFixed(1)},${bot.toFixed(1)}`,
      fill: "none", stroke: "var(--clocher-stone-l)", "stroke-width": 5, opacity: ".8",
    }));
  }

  // the beam the bells hang from, and its two corbels
  poly(decor, [pt(-0.4, ROW_GY - 0.18, BELFRY + 0.34), pt(W - 0.4, ROW_GY - 0.18, BELFRY + 0.34),
    pt(W - 0.4, ROW_GY + 0.18, BELFRY + 0.34), pt(-0.4, ROW_GY + 0.18, BELFRY + 0.34)].join(" "),
  "var(--clocher-beam)");
  poly(decor, [pt(-0.4, ROW_GY + 0.18, BELFRY + 0.34), pt(W - 0.4, ROW_GY + 0.18, BELFRY + 0.34),
    pt(W - 0.4, ROW_GY + 0.18, BELFRY + 0.06), pt(-0.4, ROW_GY + 0.18, BELFRY + 0.06)].join(" "),
  "var(--clocher-beam-l)");

  /* ---- five bells, five ropes ---- */
  for (const id of BELLS) {
    const gx = bellAt(id);
    const px = isoX(gx, ROW_GY), py = isoY(gx, ROW_GY, BELFRY);

    // The rope is the tap target, not the bell: a bell is out of reach up a tower,
    // and the whole point of a bell rope is that it brings the bell down to you.
    const rope = el("g", { id: `rope-${id}`, class: "rope", tabindex: "0", role: "button" });
    rope.setAttribute("aria-label", `Sonner ${NAME[id]} — ring ${NAME[id]}`);
    const hitY = isoY(gx, ROW_GY, HAND);
    rope.appendChild(el("rect", {
      x: (px - 21).toFixed(1), y: (py + 6).toFixed(1),
      width: 42, height: (hitY - py + 34).toFixed(1), fill: "transparent",
    }));
    const cord = el("path", {
      class: "rope__cord", fill: "none", stroke: "var(--clocher-rope)",
      "stroke-width": 2.6, "stroke-linecap": "round",
    });
    rope.appendChild(cord);
    const grip = el("ellipse", { class: "rope__grip", rx: 5.2, ry: 8, fill: "var(--clocher-grip)" });
    rope.appendChild(grip);
    game.ropes[id] = { node: rope, cord, grip, px, py, hitY };
    layers.add(rope, () => gx + ROW_GY, `rope-${id}`);
    rope.addEventListener("pointerdown", (e) => { e.stopPropagation(); ring(id); });
    rope.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); ring(id); }
    });

    // the bell itself: bronze, and bigger the lower it sounds
    const k = 1.24 - BELLS.indexOf(id) * 0.1;
    const bell = el("g", { class: "bell", "data-bell": id });
    const w = 25 * k, h = 30 * k;
    bell.innerHTML = `
      <path d="M${-w * 0.16},${-h} L${w * 0.16},${-h} L${w * 0.2},${-h * 0.82} L${-w * 0.2},${-h * 0.82} Z"
            fill="var(--clocher-bell-r)"/>
      <path d="M${-w * 0.34},${-h * 0.82} C${-w * 0.4},${-h * 0.3} ${-w},${-h * 0.24} ${-w},0
               L${w},0 C${w},${-h * 0.24} ${w * 0.4},${-h * 0.3} ${w * 0.34},${-h * 0.82} Z"
            fill="var(--clocher-bell)"/>
      <path d="M${-w * 0.34},${-h * 0.82} C${-w * 0.4},${-h * 0.3} ${-w},${-h * 0.24} ${-w},0
               L${-w * 0.3},0 C${-w * 0.3},${-h * 0.3} ${-w * 0.12},${-h * 0.5} ${-w * 0.1},${-h * 0.82} Z"
            fill="var(--clocher-bell-l)" opacity=".85"/>
      <ellipse cx="0" cy="0" rx="${w}" ry="${w * 0.3}" fill="var(--clocher-bell-r)"/>
      <ellipse cx="0" cy="${-h * 0.02}" rx="${w * 0.82}" ry="${w * 0.24}" fill="var(--clocher-mouth)"/>
      <ellipse class="bell__clapper" cx="0" cy="${-h * 0.14}" rx="${w * 0.13}" ry="${w * 0.17}"
               fill="var(--clocher-bell-r)"/>`;
    game.bells[id] = bell;
    layers.add(bell, () => gx + ROW_GY, `bell-${id}`);
  }

  ways.out = signpost(scene, 7.2, 4.0, place, go, exit);
  ways.out.sync();
};

/* ---- drawing ---------------------------------------------------------- */
const draw = () => {
  for (const id of BELLS) {
    const a = rock(id);
    const { px, py, hitY, cord, grip } = game.ropes[id];
    game.bells[id].setAttribute("transform",
      `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${(a * 15).toFixed(2)})`);
    // the rope's top follows the bell's mouth, and its slack takes up the rest —
    // so pulling a rope and a bell rocking are one motion rather than two
    const sway = a * 13;
    const midY = (py + hitY) / 2;
    cord.setAttribute("d",
      `M${(px + a * 5).toFixed(1)},${(py + 4).toFixed(1)} ` +
      `Q${(px + sway).toFixed(1)},${midY.toFixed(1)} ${(px + sway * 0.35).toFixed(1)},${(hitY + Math.abs(a) * 7).toFixed(1)}`);
    grip.setAttribute("cx", (px + sway * 0.35).toFixed(1));
    grip.setAttribute("cy", (hitY + Math.abs(a) * 7 + 7).toFixed(1));
    game.bells[id].classList.toggle("lit", Math.abs(a) > 0.04);
    // A short window that says THIS bell was just struck. The rocking alone cannot
    // say it: one strike swings the bell through zero several times, so a
    // threshold on the angle reads one bell as several — and a phrase is allowed
    // to ring the same bell twice, which a set of "bells that moved" would lose.
    const age = game.swing[id] ? now() - game.swing[id].at : 99;
    game.bells[id].classList.toggle("struck", age < 0.26);
  }
  scene.host(isoX(...HIS), isoY(HIS[0], HIS[1], FLOOR));
  layers.sort(HIS[0] + HIS[1]);
};

/* ---- what the tower says about itself --------------------------------- */
const setRound = () => {
  bellRound.textContent = game.phase === "won"
    ? `${game.phrase.length} cloches`
    : `${game.phrase.length} cloche${game.phrase.length > 1 ? "s" : ""} · ${game.played.length} rendue${game.played.length > 1 ? "s" : ""}`;
  $("#bellAgain").disabled = game.phase !== "yours";
};

const syncRopes = () => {
  const live = game.phase === "yours";
  for (const id of BELLS) {
    const node = game.ropes[id].node;
    node.toggleAttribute("disabled", !live);
    node.setAttribute("tabindex", live ? "0" : "-1");
  }
  setRound();
};

/* ---- the phrase ------------------------------------------------------- */

/** Ring the phrase at him. Scheduled on the AUDIO clock in one go rather than
 *  walked out with a timer per note: setTimeout drifts against the audio clock,
 *  and a carillon that drifts is a carillon out of tune with itself. The visual
 *  swings still need timers, but a bell you SEE a frame late is nothing and a
 *  bell you HEAR late is the whole phrase spoiled. */
const sing = () => {
  game.phase = "singing";
  game.played = [];
  syncRopes();
  game.sungAt = now();
  game.sungFor = game.phrase.length * BEAT;
  for (const [i, id] of game.phrase.entries()) {
    sfx.bell(PITCH[id], i * BEAT);
    setTimeout(() => {
      if (!game.on || game.phase !== "singing") return;
      game.swing[id] = { at: now(), amp: 1 };
    }, i * BEAT * 1000);
  }
  announce(`Le clocher sonne ${game.phrase.length} cloche${game.phrase.length > 1 ? "s" : ""}. Écoute, puis rends-la${game.phrase.length > 1 ? "-lui" : ""}.`);
  setTimeout(() => {
    if (!game.on || game.phase !== "singing") return;
    game.phase = "yours";
    syncRopes();
    setHint("À toi — tire les cordes dans le même ordre", "your turn — pull the ropes in the same order");
  }, (game.sungFor + 0.5) * 1000);
};

const ring = (id) => {
  if (!game.on || game.phase !== "yours") return;
  poke();
  game.swing[id] = { at: now(), amp: 1 };
  sfx.bell(PITCH[id]);
  kick("earL", -70); kick("earR", 70);
  game.played.push(id);

  const verdict = judge(game.phrase, game.played);
  if (verdict === "wrong") {
    game.replays += 1;
    game.phase = "singing";
    syncRopes();
    setHint("Pas celle-là — réécoute", "not that one — listen again");
    announce(`Ce n'était pas ${NAME[id]}. Le clocher recommence la phrase.`);
    // a beat of silence, then the tower simply says it again. Nothing is lost.
    setTimeout(() => { if (game.on) sing(); }, 900);
    return;
  }
  setRound();
  if (verdict !== "done") return;

  if (solved(game.phrase)) return win();
  // one bell longer, and the tower takes the lead again
  game.rounds += 1;
  game.phrase = grow(game.phrase, Math.random());
  setHint(`${game.phrase.length} cloches, maintenant`, `${game.phrase.length} bells now`);
  setTimeout(() => { if (game.on) { sing(); remember(); } }, 800);
};

const win = () => {
  game.phase = "won";
  syncRopes();
  fanfare("clocher");
  const clean = game.replays === 0 ? " Sans une seule reprise." : "";
  announce(`La phrase entière est rendue : ${game.phrase.map((b) => NAME[b]).join(", ")}.${clean}`);
  setHint(`La phrase entière, ${game.phrase.length} cloches${game.replays === 0 ? " — sans une reprise" : ""}`,
    `the whole phrase, ${game.phrase.length} bells${game.replays === 0 ? " — first time" : ""}`);
  // ring it once more, for the pleasure of it
  for (const [i, id] of game.phrase.entries()) {
    sfx.bell(PITCH[id], 0.7 + i * 0.2);
    setTimeout(() => { if (game.on) game.swing[id] = { at: now(), amp: 0.8 }; }, (0.7 + i * 0.2) * 1000);
  }
  remember();
};

const again = () => {
  if (!game.on || game.phase !== "yours") return;
  game.replays += 1;
  sing();
  remember();
};

const resetBoard = (animate = true) => {
  game.phrase = grow([], Math.random());
  game.played = [];
  game.replays = 0;
  game.rounds = 0;
  game.swing = {};
  game.phase = "idle";
  layers.reset();
  setRound(); syncRopes(); draw(); measureUI();
  remember();
  if (animate) setTimeout(() => { if (game.on) sing(); }, 500);
};

/* ---- the board, written down ------------------------------------------ */
const serialize = () => ({
  phrase: [...game.phrase], replays: game.replays, rounds: game.rounds,
  phase: game.phase === "won" ? "won" : "idle",
});

/** A phrase of known bells, or the board is refused whole. `played` is not kept:
 *  half a round is not a thing worth restoring, and the tower will simply ring
 *  the phrase again — which is what it does after a wrong bell anyway. */
const deserialize = (blob) => {
  if (!blob || typeof blob !== "object" || !Array.isArray(blob.phrase)) return false;
  if (!blob.phrase.length || blob.phrase.length > LENGTH) return false;
  if (!blob.phrase.every((b) => BELLS.includes(b))) return false;
  game.phrase = [...blob.phrase];
  game.played = [];
  game.replays = Number.isFinite(blob.replays) && blob.replays >= 0 ? blob.replays : 0;
  game.rounds = Number.isFinite(blob.rounds) && blob.rounds >= 0 ? blob.rounds : 0;
  game.phase = blob.phase === "won" ? "won" : "idle";
  return true;
};

const remember = () => valley.keep("clocher", serialize());

/* ---- the three beats of arriving somewhere ---------------------------- */
const wake = () => { buildWorld(); scene.show(true); };
const leave = () => { game.on = false; };
const sleep = () => { scene.show(false); game.on = false; };
const land = () => {
  game.on = true;
  ways.out?.sync();
  draw(); measureUI();
  // a phrase cannot be half-sung across a walk away from here: the tower starts
  // the round over rather than expecting notes he never heard
  if (game.phase !== "won") {
    game.phase = "idle";
    syncRopes();
    setTimeout(() => { if (game.on && game.phase === "idle") sing(); }, 620);
  } else {
    syncRopes();
  }
  setTimeout(() => { refreshCTM(); draw(); measureUI(); }, 20);
  setTimeout(refreshCTM, 1000);
};

/* ---- entering and leaving -------------------------------------------- */
export const enter = () => {
  if (game.on || !valley.opened("clocher")) return;
  wake();
  poke();
  mount(place);
  panTo(3, true);
  valley.arrive("clocher");
  release();
  dropShears();
  cancelDrag();
  if (!game.seen) {
    game.seen = true;
    if (!deserialize(valley.board("clocher"))) { game.phrase = grow([], Math.random()); game.phase = "idle"; }
  }
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

/* ---- bound at boot; the tower is not built until the first visit ------- */
export const build = () => {
  $("#bellAgain").addEventListener("click", again);
  $("#bellReset").addEventListener("click", () => { resetBoard(); });

  addEventListener("keydown", (e) => {
    if (!game.on) return;
    if (e.key === "Escape") { exit(); return; }
    const k = e.key.toLowerCase();
    if (k === "r") { resetBoard(); return; }
    if (k === "a") { e.preventDefault(); again(); return; }
    const n = ["1", "2", "3", "4", "5"].indexOf(e.key);
    if (n !== -1) { e.preventDefault(); ring(BELLS[n]); }
  });

  // Opened by having stacked the barn. La traversée opens le pont and la grange
  // opens le clocher, so each of the two doors the meadow already has leads on to
  // one more — and a player who only ever shears him still gets somewhere new.
  const watch = () => {
    if (valley.opened("clocher") || valley.solves("grange") < SOLVES_TO_OPEN_CLOCHER) return;
    if (!valley.open("clocher")) return;
    setTimeout(() => sfx.bell(PITCH.sol), 400);
    setTimeout(() => sfx.bell(PITCH.do, 0), 1000);
    setTimeout(() => setHint("Des cloches, plus loin dans la vallée — le clocher",
      "bells, further down the valley — the bell tower"), 900);
    announce("Le clocher est ouvert, au bout de la vallée : suis le panneau.");
  };
  valley.watch(watch);
  watch();
};

/* ---- per-frame: dust in the light, and the bells settling -------------- */
const frame = (dt, t) => {
  if (!REDUCED && state.mood > 0.5 && Math.random() < dt * 1.4) sparkle(rand(150, 250), rand(140, 250));
  draw();
};

const ways = {};

const place = {
  id: "clocher",
  mode: "bells",
  road: 3,
  label: ["le clocher", "the bell tower"],
  doorway: () => [isoX(7.2, 4.0), isoY(7.2, 4.0, FLOOR)],
  frame,
  wake, leave, sleep, land,
  enter, exit,
  // a tap on him asks to hear it again, which is the only thing he could mean
  tapSheep: () => again(),
};

enrol(place);
export default place;
