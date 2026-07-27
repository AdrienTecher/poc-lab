// The treat: clovers growing in the grass, picked up and offered to him.
//
// A clover is the care loop's currency. It never buys happiness — only a cuddle
// does — but it tops up a window that is already running, and five of them grow
// the four-leaf one that opens the river. Solving a place grows the patch back
// wider, so the reward for a puzzle is a meadow with more in it, never a number.
import { el, tapTarget } from "../engine/svg.js";
import { say } from "../ui/copy.js";
import { rand, now } from "../engine/math.js";
import { kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { crumb, heart } from "../engine/particles.js";
import { state } from "../state.js";
import { announce } from "../ui/hint.js";
import { meadow, placeProp, layoutProps } from "./scenery.js";
import { toSvg, poke } from "./pointer.js";
import { onSheep } from "./sheep.js";
import { topUp } from "./mood.js";
import * as valley from "./valley.js";

const CLOVER_X = [140, 355, 890, 560, 250, 760];
const clovers = [];

const dragNode = document.createElement("div");
dragNode.className = "drag";
dragNode.innerHTML =
  `<svg viewBox="-22 -22 44 44"><g><use href="#cloverLeaves" fill="#4ea343"/><use href="#cloverLeaves" fill="#69c257" transform="scale(.82)"/></g></svg>`;

/** Held clovers wobble with the hand carrying them. */
export const dragTo = (x, y) => {
  if (!state.dragging) return;
  dragNode.style.transform = `translate(${x}px, ${y}px) rotate(${Math.sin(now() * 7) * 9}deg)`;
};

const startDrag = (clover, x, y) => {
  state.dragging = clover;
  clover.classList.add("picked");
  document.body.appendChild(dragNode);
  dragTo(x, y);
  poke();
};

const regrow = (clover) => setTimeout(() => clover.classList.remove("picked"), 5000);

export const drop = (e) => {
  const clover = state.dragging;
  if (!clover) return;
  state.dragging = null;
  dragNode.remove();
  const p = toSvg(e);
  // generous drop zone: anywhere near his head counts as an offering
  if (onSheep(p) || Math.hypot(p.x - 200, p.y - 196) < 190) { feed(); regrow(clover); }
  else clover.classList.remove("picked");
};

/** Put down whatever is in your hand without offering it — a place he walks
 *  into is no place to be holding a clover. */
export const cancelDrag = () => {
  if (!state.dragging) return;
  state.dragging.classList.remove("picked");
  state.dragging = null;
  dragNode.remove();
};

export const feed = () => {
  state.chewUntil = now() + 2.1;
  poke();
  sfx.munch();
  kick("earL", -180); kick("earR", 180);
  for (const i of [...Array(8).keys()]) setTimeout(() => crumb(200 + rand(-14, 14), 206), i * 70);
  valley.eat();
  if (topUp(30000)) {
    setTimeout(() => heart(200, 172), 900);
    announce(say.clover.topUp);
  } else {
    announce(say.clover.noWindow);
  }
};

const feedFrom = (clover) => { clover.classList.add("picked"); feed(); regrow(clover); };

/** Offer him the nearest clover still standing — the keyboard's "f". */
export const feedNearest = () => {
  const c = clovers.find((c) => !c.classList.contains("picked"));
  if (c) feedFrom(c);
};

const addClover = (x) => {
  const g = el("g", { class: "clover", tabindex: "0", role: "button" });
  g.setAttribute("aria-label", "Offrir un trèfle — give him a clover");
  tapTarget(g, 46, 62, -26);
  g.appendChild(el("path", { d: "M0,2 L0,28", stroke: "#3f8a36", "stroke-width": 3, "stroke-linecap": "round", fill: "none" }));
  const leaves = el("g", { class: "clover__leaves" });
  leaves.appendChild(el("use", { href: "#cloverLeaves", fill: "#4ea343" }));
  leaves.appendChild(el("use", { href: "#cloverLeaves", fill: "#69c257", transform: "scale(.82)" }));
  g.appendChild(leaves);
  meadow.appendChild(g);
  g.addEventListener("pointerdown", (e) => { e.stopPropagation(); startDrag(g, e.clientX, e.clientY); });
  g.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); feedFrom(g); } });
  clovers.push(placeProp(g, x, 212, 1.35));
  return g;
};

// the reward is a clover in the meadow, never a number on a screen
const grow = () => {
  const want = Math.min(3 + Math.min(valley.solves("riviere"), 3), CLOVER_X.length);
  while (clovers.length < want) addClover(CLOVER_X[clovers.length]);
  layoutProps();
};

export const build = () => {
  for (const x of CLOVER_X.slice(0, 3)) addClover(x);
  valley.watch(grow);
};

/** Called once at boot, after every prop is in the ground: past solves may have
 *  earned more than the three he starts with. */
export const settle = grow;
