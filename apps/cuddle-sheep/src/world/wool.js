// The fleece, and the blades.
//
// Wool is a body state; mood is a feeling state. Nothing in this module writes
// state.happyUntil, state.cuddle, the mood spring or --m, and nothing here calls
// goHappy(): shearing reads his mood as a gate, and never the other way round.
//
// The fleece is one stored instant — when it was last taken to zero — so it
// grows on wall-clock time whether the tab is open or not.
import * as save from "../engine/save.js";
import { el, tapTarget } from "../engine/svg.js";
import { clamp, rand, now } from "../engine/math.js";
import { kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { sparkle, tuft } from "../engine/particles.js";
import { state } from "../state.js";
import { WOOL_FULL_MS, SHEAR_TARGET, WOOL_READY, SHEAR_MIN, SHEAR_CALM } from "../rules.js";
import { announce, setHint } from "../ui/hint.js";
import { meadow, placeProp, fleeceToCloud } from "./scenery.js";
import * as valley from "./valley.js";
import { lastClient, poke } from "./pointer.js";
import { hit } from "./sheep.js";

export const woolNow = () => clamp((Date.now() - state.woolFrom) / WOOL_FULL_MS, 0, 1);
const setWool = (v) => { state.woolFrom = Date.now() - clamp(v, 0, 1) * WOOL_FULL_MS; };

let wrote = 0;
const saveWool = (force) => {
  if (!force && Date.now() - wrote < 500) return;
  wrote = Date.now();
  save.data.sheep.woolFrom = state.woolFrom;
  save.touch(force);
};
addEventListener("pagehide", () => saveWool(true));
state.wool = woolNow();

// the shears wait in the grass on the other side of the meadow
export const shearsNode = el("g", { class: "shears", tabindex: "0", role: "button" });
const toolCursor = document.createElement("div");
toolCursor.className = "tool-cursor";
toolCursor.innerHTML = `<svg viewBox="-26 -36 52 68"><use href="#shearsShape"/></svg>`;

export const moveTool = (x, y) => {
  const tilt = state.shearing ? Math.sin(now() * 24) * 15 : -10;
  toolCursor.style.transform = `translate(${x}px, ${y}px) rotate(${tilt.toFixed(1)}deg)`;
};

/** The held tool follows the pointer that just went down, not the one that last
 *  moved — otherwise it jumps in from wherever the mouse was left. */
export const grabTool = (e) => { lastClient.x = e.clientX; lastClient.y = e.clientY; moveTool(e.clientX, e.clientY); };

export const takeShears = () => {
  if (state.tool === "shears") return;
  if (state.wool < SHEAR_MIN) {
    sfx.whiff();
    setHint("Sa laine est trop courte — elle repousse", "his wool is too short — it is growing back");
    announce("Sa laine est trop courte pour la tonte.");
    return;
  }
  state.tool = "shears";
  shearsNode.classList.add("held");
  document.body.appendChild(toolCursor);
  document.body.classList.add("tooling");
  moveTool(lastClient.x, lastClient.y);
  sfx.snip();
  poke();
  setHint("Passe les ciseaux sur sa laine", "run the shears over his wool");
  announce("Ciseaux en main. Passe-les sur sa laine pour le tondre.");
};

export const dropShears = () => {
  if (state.tool !== "shears") return;
  saveWool(true);
  state.tool = null;
  state.shearing = false;
  shearsNode.classList.remove("held");
  toolCursor.remove();
  document.body.classList.remove("tooling");
};

const fleeceOff = () => {
  setWool(0);
  state.wool = 0;
  valley.shear();   // the tally the barn is built out of
  state.shiverUntil = now() + 3.4;
  kick("hop", -250); kick("earL", -240); kick("earR", 240);
  sfx.chime(); sfx.bleat(state.mood > 0.5);
  // the fleece leaves as a dozen tufts and comes back as a cloud
  for (const i of [...Array(12).keys()]) setTimeout(() => tuft(rand(150, 250), rand(205, 265)), i * 45);
  for (const i of [...Array(6).keys()]) setTimeout(() => sparkle(rand(150, 250), rand(190, 250)), 300 + i * 90);
  setTimeout(fleeceToCloud, 900);
  announce("La toison est tombée : Nuage est tout neuf, et un peu frileux.");
  setHint("Nuage est tondu — trois câlins avant la prochaine tonte", "shorn: three cuddles until the next one");
  setTimeout(dropShears, 800);
};

let refusedAt = 0;
const refuse = (sx) => {
  kick("hop", -120);
  kick("sway", sx < 200 ? 130 : -130);
  if (now() - refusedAt < 2.4) return;
  refusedAt = now();
  sfx.whiff(); sfx.bleat(false);
  setHint("Rassure-le d'abord — un câlin, puis la tonte", "settle him with a cuddle first, then shear");
  announce("Nuage se dérobe : il faut d'abord le rassurer avec un câlin.");
};

/** One stroke of the blades over `d` svg units of his side. */
export const shearStroke = (p, d) => {
  const before = state.wool;
  if (before <= 0.02) return;  // already bare — regrowth must show before the blades bite again
  if (state.mood < SHEAR_CALM) { refuse(p.x); return; }
  setWool(before - d / SHEAR_TARGET);
  saveWool(false);
  state.wool = woolNow();
  poke();
  if (Math.random() < d / 24) tuft(p.x + rand(-16, 16), p.y + rand(-14, 14));
  if (Math.random() < d / 80) sfx.snip();
  if (Math.random() < d / 420) kick(Math.random() < 0.5 ? "earL" : "earR", rand(-180, 180));
  if (state.wool <= 0.02) fleeceOff();
};

export const build = () => {
  shearsNode.setAttribute("aria-label", "Prendre les ciseaux pour la tonte — pick up the shears");
  tapTarget(shearsNode, 42, 68, -34);
  shearsNode.appendChild(el("use", { href: "#shearsShape" }));
  meadow.appendChild(shearsNode);
  placeProp(shearsNode, 1145, 206, 2);

  shearsNode.addEventListener("pointerdown", (e) => { e.stopPropagation(); takeShears(); });
  shearsNode.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); takeShears(); hit.focus(); }
  });
};

/** Holding Space with the shears in hand shears at a steady rate — the keyboard
 *  equivalent of a stroke, and gated by the same calm. */
export const step = (dt) => {
  if (state.byKey === "shear" && state.wool > 0.02 && state.mood >= SHEAR_CALM) {
    setWool(state.wool - dt * 0.42);
    saveWool(false);
    state.wool = woolNow();
    if (Math.random() < dt * 9) tuft(rand(150, 250), rand(205, 262));
    if (Math.random() < dt * 3.4) sfx.snip();
    if (state.wool <= 0.02) fleeceOff();
  }
  const w = state.wool = woolNow();
  shearsNode.classList.toggle("ready", w >= WOOL_READY && state.tool !== "shears");
  return w;
};
