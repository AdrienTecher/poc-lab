// The meadow he stands in: sun rays, a bank of clouds, grass, flowers, and the
// rail that keeps small props the right size on any screen.
//
// Nothing here knows about the sheep. It is scenery in the theatrical sense —
// painted, alive, and entirely indifferent to the actor.
import { $, el } from "../engine/svg.js";
import { clamp, rand } from "../engine/math.js";

export const meadow = $("#meadow");
const turf = $("#turf"), bank = $("#cloudbank"), rays = $("#rays");

const flowers = [];
const PETAL = ["#ff9ec4", "#ffd166", "#c9a7ff", "#fff1f5"];

// The meadow viewBox is stretched to the viewport width, which would squash any
// prop drawn in it — so every prop carries its own counter-scale, redone on resize.
const props = [];
export const placeProp = (node, x, y, k) => {
  props.push({ node, x, y, k });
  return node;
};

export const layoutProps = () => {
  const box = meadow.getBoundingClientRect();
  const sx = (box.width || 1200) / 1200, sy = (box.height || 260) / 260;
  // props hold a fixed on-screen size, which crowds them together on a narrow
  // meadow — so they shrink with the width once there is no room to spare
  const fit = clamp(box.width / 900, 0.6, 1);
  for (const p of props) {
    const k = p.k * fit;
    p.node.setAttribute("transform", `translate(${p.x} ${p.y}) scale(${(k * sy / sx).toFixed(4)} ${k})`);
  }
};

/** A shorn fleece floats off and joins the cloud bank — he is named after one. */
export const fleeceToCloud = () => {
  const g = el("g", { class: "puff" });
  const scale = rand(0.55, 0.9);
  g.setAttribute("transform", `translate(0 ${rand(70, 150)}) scale(${scale})`);
  const seconds = rand(110, 190);
  g.style.animationDuration = `${seconds}s`;
  // start it mid-drift, at the sky position right above where the fleece let go
  g.style.animationDelay = `${-seconds * 0.5}s`;
  for (const [cx, cy, r] of [[0, 0, 26], [30, -11, 34], [64, 2, 24], [30, 12, 30]]) {
    g.appendChild(el("ellipse", { cx, cy, rx: r * 1.3, ry: r * 0.8 }));
  }
  bank.appendChild(g);
  while (bank.childElementCount > 9) bank.firstElementChild.remove();
};

// the meadow blooms when he does, and only crosses that line once
let bloomed = false;
export const setBloom = (on) => {
  if (on === bloomed) return;
  bloomed = on;
  for (const f of flowers) f.classList.toggle("bloom", on);
};

export const build = () => {
  for (const i of [...Array(12).keys()]) {
    const s = document.createElement("span");
    s.style.transform = `rotate(${i * 30}deg)`;
    rays.appendChild(s);
  }

  for (const i of [...Array(5).keys()]) {
    const g = el("g", { class: "puff" });
    g.setAttribute("transform", `translate(${rand(0, 900)} ${50 + i * 46 + rand(-14, 14)}) scale(${rand(0.65, 1.3)})`);
    g.style.animationDuration = `${rand(95, 180)}s`;
    g.style.animationDelay = `${-rand(0, 140)}s`;
    for (const [cx, cy, r] of [[0, 0, 26], [30, -11, 34], [64, 2, 24], [30, 12, 30]]) {
      g.appendChild(el("ellipse", { cx, cy, rx: r * 1.3, ry: r * 0.8 }));
    }
    bank.appendChild(g);
  }

  for (const i of [...Array(88).keys()]) {
    const x = (i / 88) * 1240 - 20 + rand(-7, 7);
    const h = rand(30, 88), w = rand(5, 10), bend = rand(-22, 22);
    const p = el("path", {
      class: "blade",
      d: `M${x},260 C${x + bend * 0.3},${260 - h * 0.5} ${x + bend},${260 - h * 0.8} ${x + bend * 1.2},${260 - h} C${x + bend + w},${260 - h * 0.7} ${x + w},${260 - h * 0.3} ${x + w},260 Z`,
    });
    p.style.animationDuration = `${rand(3, 5.6)}s`;
    p.style.animationDelay = `${-rand(0, 5)}s`;
    turf.appendChild(p);
  }

  // A flower is two nested groups on purpose: CSS animates the inner one, and a
  // CSS transform would otherwise overwrite the placing transform attribute and
  // stack all twenty at the origin.
  for (const i of [...Array(20).keys()]) {
    const anchor = el("g");
    anchor.setAttribute("transform", `translate(${rand(20, 1180)} ${rand(140, 232)})`);
    const g = el("g", { class: "flower" });
    g.style.transitionDelay = `${rand(0, 0.7)}s`;
    const hue = PETAL[i % PETAL.length];
    g.appendChild(el("path", { d: `M0,0 L${rand(-5, 5)},28`, stroke: "#4e9440", "stroke-width": 3.4, "stroke-linecap": "round", fill: "none" }));
    for (const k of [...Array(5).keys()]) {
      const a = (k / 5) * Math.PI * 2;
      g.appendChild(el("circle", { cx: Math.cos(a) * 7, cy: Math.sin(a) * 7, r: 5.6, fill: hue }));
    }
    g.appendChild(el("circle", { r: 4, fill: "#ffdf6e" }));
    anchor.appendChild(g);
    turf.appendChild(anchor);
    flowers.push(g);
  }

  addEventListener("resize", layoutProps);
};
