// Nuage himself: the rig, and everything he does with it.
//
// One sheep exists for the whole game — a place hosts him rather than drawing
// its own. Every limb is a spring, so nothing here tweens: the frame sets
// targets and the springs decide how he gets there. That is the whole reason he
// reads as alive rather than animated.
import { $, el } from "../engine/svg.js";
import { clamp, lerp, rand, now, REDUCED } from "../engine/math.js";
import { springs, S, set, v, kick, stepSprings } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { tear, tuft, sparkle, zzz } from "../engine/particles.js";
import { state } from "../state.js";
import { DOZE_AFTER, SHEAR_CALM } from "../rules.js";
import { active } from "../places/registry.js";
import { ptr, decay, poke } from "./pointer.js";
import { flying } from "./butterflies.js";

S("lean", 0, 90, 13);      // head tilt, degrees
S("gazeX", 0, 110, 15);
S("gazeY", 0, 110, 15);
S("hop", 0, 150, 11);      // vertical body offset, driven by impulses
S("earL", 0, 130, 12);
S("earR", 0, 130, 12);
S("tail", 0, 170, 11);
S("sway", 0, 60, 10);
S("mouth", -1, 80, 13);    // -1 frown … +1 grin
S("brow", 1, 80, 13);
S("open", 0, 190, 14);     // mouth opening, for bleats and chewing
// How he takes the blades: -1 flinching away, +1 leaning into them. Slow hands
// earn trust, fast ones lose it. Wool is a body state; mood is a feeling state —
// this spring is body, and must never be wired into --m.
S("nerve", 0, 40, 11);

export const hit = $("#hit");
const head = $("#head"), bodyG = $("#body"), shadow = $("#shadow");
const earL = $("#earL"), earR = $("#earR"), tail = $("#tail");
const eyeL = $("#eyeL"), eyeR = $("#eyeR");
const lidL = eyeL.querySelector(".lid"), lidR = eyeR.querySelector(".lid");
const arcL = eyeL.querySelector(".eye-arc"), arcR = eyeR.querySelector(".eye-arc");
const browL = $("#browL"), browR = $("#browR");
const mouth = $("#mouth"), blushL = $("#blushL"), blushR = $("#blushR");
const petGlowEl = $("#petGlow"), rcBody = $("#rcBody");
const bodyCore = $("#bodyCore"), bodySheen = $("#bodySheen");

// the hit region breathes with the fleece, so a fluffy sheep is a bigger target
export const sheepRX = () => 118 + 42 * state.wool;
export const sheepRY = () => 116 + 32 * state.wool;
export const onSheep = (p) => {
  const dx = (p.x - 200) / sheepRX(), dy = (p.y - 238) / sheepRY();
  return dx * dx + dy * dy <= 1;
};

export const bleat = () => {
  state.bleatUntil = now() + 0.55;
  sfx.bleat(state.mood > 0.5);
  kick("hop", -70); kick("earL", -120); kick("earR", 120);
  poke();
};

/* ------------------------------------------------------------------ *
 * Wool: a ring of blobs around an ellipse. Each breathes on its own phase
 * and gets pushed aside by the petting hand.
 * ------------------------------------------------------------------ */
// Blobs keep their polar definition rather than a baked position, because the
// fleece length rescales the ring and the curls independently every frame.
const blobs = [];
const addBlobs = (parent, part, cx, cy, rx, ry, count, radius, from = -Math.PI, span = Math.PI * 2) => {
  for (const i of [...Array(count).keys()]) {
    const a = from + (span * i) / count;
    const b = {
      node: el("circle"), part,
      cx, cy, rx, ry, ca: Math.cos(a), sa: Math.sin(a),
      bx: cx + Math.cos(a) * rx, by: cy + Math.sin(a) * ry,
      r: radius + Math.sin(i * 2.7) * radius * 0.15,
      phase: rand(0, Math.PI * 2),
      speed: rand(0.8, 1.5),
    };
    parent.appendChild(b.node);
    blobs.push(b);
  }
};

const rainDrops = [];

export const build = () => {
  addBlobs($("#woolBody"), "body", 200, 240, 88, 52, 16, 28);
  addBlobs($("#woolHead"), "head", 200, 186, 45, 42, 7, 18, -Math.PI * 0.97, Math.PI * 0.94);

  for (const i of [...Array(9).keys()]) {
    const node = el("line", { class: "drop" });
    $("#rain").appendChild(node);
    rainDrops.push({ node, x: rand(-42, 42), y: rand(0, 70), sp: rand(90, 150), len: rand(7, 14) });
  }
};

/* ---- scheduled life: blinks, twitches, hops, bleats, tears ---- */
let nextBlink = 2, blinkT = -1;
let nextTwitch = 4, nextIdleHop = 4, nextTear = 22, nextBaa = 12, nextZ = 0, nextShake = 8;

export const step = (dt, t, m) => {
  if (now() - state.lastPoke > DOZE_AFTER && m < 0.2 && !active()) state.dozing = true;
  const dozing = state.dozing;
  const chewing = now() < state.chewUntil;
  const bleating = now() < state.bleatUntil;
  const petting = state.petting;
  const shearing = state.shearing;
  const shivering = now() < state.shiverUntil;
  const w = state.wool;

  /* ---- what he looks at: your hand, else a butterfly, else a slow drift ---- */
  let gx, gy;
  const bfly = flying();
  if (state.dragging) {
    gx = 0; gy = 0.7;
  } else if (ptr.inside && now() - state.lastPointer < 2.2) {
    gx = clamp((ptr.x - 200) / 190, -1, 1);
    gy = clamp((ptr.y - 190) / 170, -1, 1);
  } else if (bfly && !dozing) {
    gx = clamp((bfly.x - 200) / 200, -1, 1);
    gy = clamp((bfly.y - 190) / 180, -1, 1);
  } else {
    gx = Math.sin(t * 0.31) * 0.35;
    gy = Math.sin(t * 0.23 + 1.4) * 0.2;
  }
  if (now() < state.lookAt) { gx = 0.92; gy = 0.35; }
  if (dozing) { gx *= 0.1; gy = 0.6; }
  set("gazeX", gx); set("gazeY", gy);

  /* ---- posture ---- */
  decay(dt);
  if (state.tool === "shears") {
    const near = clamp(1 - Math.hypot(ptr.x - 200, (ptr.y - 240) * 1.5) / 150, 0, 1);
    set("nerve", m >= SHEAR_CALM ? near * (1 - clamp(ptr.speed / 300, 0, 1)) : -near);
  } else set("nerve", 0);
  const nerve = v("nerve");
  const toward = ptr.x < 200 ? -1 : 1;
  set("lean", dozing ? 7 : lerp(-2, 0, m) + gx * lerp(5, 9, m) + (petting ? gx * 5 : 0) + nerve * 4 * toward);
  set("mouth", lerp(-1, 1, m) + (petting ? 0.3 : 0));
  set("brow", clamp(1 - m + Math.max(0, -nerve) * 0.5, 0, 1));
  set("earL", dozing ? 14 : lerp(26, -12, m) + (petting ? -8 : 0) + (nerve < 0 ? -nerve * 22 : -nerve * 9));
  set("earR", dozing ? -14 : lerp(-26, 12, m) + (petting ? 8 : 0) - (nerve < 0 ? -nerve * 22 : -nerve * 9));
  set("tail", Math.sin(t * (2 + m * 7)) * lerp(4, 22, m));
  // he holds still while the blades are on him
  set("sway", Math.sin(t * (0.6 + m * 0.9)) * lerp(2, 7, m) * (shearing ? 0.25 : 1) + nerve * 3.5 * toward);
  set("open", bleating ? 1 : chewing ? 0.44 + Math.sin(t * 17) * 0.34 : 0);

  nextBlink -= dt;
  if (nextBlink <= 0 && !dozing) { blinkT = 0.16; nextBlink = rand(2.4, 6.5); }
  if (blinkT >= 0) blinkT -= dt;

  nextTwitch -= dt;
  if (nextTwitch <= 0) {
    nextTwitch = rand(3.5, 9);
    if (!dozing) kick(Math.random() < 0.5 ? "earL" : "earR", rand(-260, 260));
  }

  if (m > 0.55 && !REDUCED) {
    nextIdleHop -= dt;
    if (nextIdleHop <= 0) {
      nextIdleHop = rand(2.6, 5.4);
      kick("hop", -190);
      if (Math.random() < 0.5) sparkle(rand(140, 260), rand(190, 250));
    }
    nextBaa -= dt;
    if (nextBaa <= 0) { nextBaa = rand(12, 28); bleat(); }
  } else {
    nextTear -= dt;
    if (nextTear <= 0 && m < 0.25 && !dozing) {
      nextTear = rand(18, 34);
      tear(200 + (Math.random() < 0.5 ? -22 : 22), 188);
    }
  }
  if (dozing) {
    nextZ -= dt;
    if (nextZ <= 0) { nextZ = 2.3; zzz(234, 152); }
  }

  // an overgrown fleece itches: he shakes it out and loses a tuft or two
  if (w > 0.8 && !dozing && !REDUCED) {
    nextShake -= dt;
    if (nextShake <= 0) {
      nextShake = rand(9, 17);
      kick("sway", rand(-95, 95));
      kick("earL", -320); kick("earR", 320);
      for (const i of [...Array(3).keys()]) setTimeout(() => tuft(rand(160, 240), rand(200, 250)), i * 90);
    }
  }

  stepSprings(dt);

  /* ---- body: breathe, hop, squash ---- */
  const breathe = Math.sin(t * 1.35) * (1.6 + m * 0.8) * lerp(1, 0.45, Math.max(0, nerve));
  const hopY = v("hop");
  const squash = clamp(1 - springs.hop.vel / 2600, 0.9, 1.1);
  const by = hopY + breathe;
  const shiver = shivering ? Math.sin(t * 42) * 1.7 : 0;
  bodyG.setAttribute("transform",
    `translate(${(v("sway") + shiver).toFixed(2)} ${by.toFixed(2)}) translate(200 344) scale(${(2 - squash).toFixed(4)} ${squash.toFixed(4)}) translate(-200 -344)`);
  shadow.setAttribute("transform", `translate(200 352) scale(${(1 + hopY / 300).toFixed(3)} 1) translate(-200 -352)`);
  shadow.setAttribute("opacity", clamp(0.16 - hopY / 900, 0.05, 0.2).toFixed(3));

  /* ---- wool: the fleece length rescales the ring, the curls and the core ---- *
   * Every factor is written so that w = FIRST_FLEECE (0.45) reproduces exactly
   * the silhouette he shipped with: shorn is slimmer, full is comically fluffy. */
  const kRing = 0.865 + 0.30 * w, kRingY = 0.91 + 0.20 * w;
  const kCurl = 0.66 + 0.755 * w, kCore = 0.883 + 0.26 * w;
  const fringe = Math.max(0, w - 0.6) * 22;   // an overgrown forelock creeps down over his brows
  bodyCore.setAttribute("rx", (86 * kCore).toFixed(1));
  bodyCore.setAttribute("ry", (50 * kCore).toFixed(1));
  bodySheen.setAttribute("rx", (102 * kCore).toFixed(1));
  bodySheen.setAttribute("ry", (70 * kCore).toFixed(1));

  const hand = (petting || shearing) && state.byKey !== "pet";
  for (const b of blobs) {
    const isHead = b.part === "head";
    let x = b.cx + b.ca * b.rx * (isHead ? 1 : kRing);
    let y = b.cy + b.sa * b.ry * (isHead ? 1 : kRingY) + (isHead ? fringe : 0);
    const wob = Math.sin(t * b.speed + b.phase) * (1.6 + m * 1.4);
    if (hand) {
      const dx = x - ptr.x + v("sway"), dy = y - ptr.y + by;
      const d = Math.hypot(dx, dy) || 1;
      const reach = shearing ? 54 : 76;
      if (d < reach) { const f = (1 - d / reach) * (shearing ? 5 : 9); x += (dx / d) * f; y += (dy / d) * f; }
    }
    b.node.setAttribute("cx", (x + wob * 0.4).toFixed(2));
    b.node.setAttribute("cy", (y + wob).toFixed(2));
    b.node.setAttribute("r", (b.r * (isHead ? 0.62 + 0.62 * w : kCurl) + wob * 0.5).toFixed(2));
  }

  /* ---- head, ears, tail ---- */
  head.setAttribute("transform",
    `rotate(${v("lean").toFixed(2)} 200 216) translate(${(v("gazeX") * 4).toFixed(2)} ${(Math.sin(t * 1.35 + 0.6) * 1.2 + v("gazeY") * 2 + (1 - m) * 5).toFixed(2)})`);
  earL.setAttribute("transform", `translate(160 178) rotate(${(-16 + v("earL")).toFixed(2)})`);
  earR.setAttribute("transform", `translate(240 178) rotate(${(16 + v("earR")).toFixed(2)})`);
  tail.setAttribute("transform", `translate(${(300 + 26 * w).toFixed(1)} ${(248 - 4 * w).toFixed(1)}) rotate(${v("tail").toFixed(2)} -16 -4) scale(${(0.72 + 0.62 * w).toFixed(3)})`);

  /* ---- eyes ---- */
  const gxp = v("gazeX") * 3.2, gyp = v("gazeY") * 2.6;
  const blink = blinkT > 0 ? clamp(Math.abs(blinkT - 0.08) / 0.08, 0.05, 1) : 1;
  const lidOpen = dozing ? 0.06 : blink * lerp(0.84, 1, m);
  const beaming = m > 0.86 && (petting || bleating || springs.hop.vel < -60);
  const trusting = state.tool === "shears" && nerve > 0.45 && m >= SHEAR_CALM; // the consent beat
  const arcAmt = beaming || dozing || trusting ? 1 : 0;

  for (const [g, lid, arc, sx] of [[eyeL, lidL, arcL, -1], [eyeR, lidR, arcR, 1]]) {
    g.setAttribute("transform", `translate(${(200 + sx * 22 + gxp).toFixed(2)} ${(181 + gyp).toFixed(2)})`);
    lid.setAttribute("transform", `scale(${(1 + (1 - m) * 0.06).toFixed(3)} ${lidOpen.toFixed(3)})`);
    lid.setAttribute("opacity", (1 - arcAmt).toFixed(2));
    arc.setAttribute("opacity", arcAmt.toFixed(2));
    arc.setAttribute("transform", dozing || (trusting && m < 0.5) ? "scale(1 -0.8) translate(0 -3)" : "scale(1 1)");
  }

  const bt = v("brow");
  for (const [b, sx] of [[browL, -1], [browR, 1]]) {
    b.setAttribute("transform",
      `translate(${(200 + sx * 22 + gxp * 0.7).toFixed(2)} ${(160 + gyp * 0.6 - (1 - bt) * 3).toFixed(2)}) rotate(${(sx * -bt * 22).toFixed(2)})`);
    b.setAttribute("opacity", (0.25 + bt * 0.75).toFixed(2));
  }

  /* ---- mouth: one quadratic whose control point carries the whole mood ---- */
  const mc = v("mouth"), open = v("open");
  const my = 207 + gyp * 0.4 + open * 2;
  const halfW = 14 + open * 2;
  if (open > 0.06) {
    const oh = 4 + open * 9;
    mouth.setAttribute("fill", "#8c4b58");
    mouth.setAttribute("d", `M${200 - halfW},${my} Q200,${my + oh * 1.8} ${200 + halfW},${my} Q200,${my - oh * 0.3} ${200 - halfW},${my} Z`);
  } else {
    mouth.setAttribute("fill", "none");
    mouth.setAttribute("d", `M${200 - halfW},${my.toFixed(2)} Q200,${(my + mc * 7).toFixed(2)} ${200 + halfW},${my.toFixed(2)}`);
  }

  const blushA = clamp(m * 0.55 + (petting ? 0.35 : 0), 0, 0.85);
  blushL.setAttribute("opacity", blushA.toFixed(2));
  blushR.setAttribute("opacity", blushA.toFixed(2));

  petGlowEl.setAttribute("opacity", hand && !shearing ? "1" : "0");
  if (hand) { petGlowEl.setAttribute("cx", ptr.x.toFixed(1)); petGlowEl.setAttribute("cy", ptr.y.toFixed(1)); }

  /* ---- his weather: the cloud floats up and away as he cheers up ---- */
  rcBody.setAttribute("transform",
    `translate(${(Math.sin(t * 0.5) * 6).toFixed(2)} ${(Math.sin(t * 0.8) * 3 - m * 80).toFixed(2)}) scale(${(1 - m * 0.35).toFixed(3)})`);
  for (const d of rainDrops) {
    d.y += d.sp * dt * (1 - m);
    if (d.y > 64) { d.y = rand(-12, 8); d.x = rand(-44, 44); }
    const x = 200 + d.x, y = 64 + d.y - m * 80;
    d.node.setAttribute("x1", x.toFixed(1)); d.node.setAttribute("y1", y.toFixed(1));
    d.node.setAttribute("x2", (x - 1.5).toFixed(1)); d.node.setAttribute("y2", (y + d.len).toFixed(1));
    d.node.setAttribute("opacity", (0.75 * (1 - m)).toFixed(2));
  }

  hit.setAttribute("rx", sheepRX().toFixed(1));
  hit.setAttribute("ry", sheepRY().toFixed(1));
};
