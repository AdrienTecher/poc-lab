// Hearts, sparkles, crumbs, tufts and sleep. A fixed pool: a burst may cost
// the oldest particle, never a growing DOM.
import { el } from "./svg.js";
import { rand } from "./math.js";

const parts = [];
let fx = null;

/** Point the pool at the layer that should hold the confetti. */
export const attachParticles = (node) => { fx = node; };
const PART_CAP = 140;
export const spawn = (node, opts) => {
  if (parts.length >= PART_CAP) parts.shift().node.remove();
  fx.appendChild(node);
  parts.push({ node, age: 0, life: 1.4, vx: 0, vy: -40, spin: 0, rot: 0, scale: 1, grow: 0, gravity: 0, x: 0, y: 0, ...opts });
};
export const heart = (x, y) => spawn(el("use", { href: "#heartPath", fill: "#ff7fa6" }),
  { x, y, vx: rand(-26, 26), vy: rand(-64, -104), life: rand(1.1, 1.7), scale: rand(0.5, 0.95), spin: rand(-60, 60) });
export const sparkle = (x, y) => spawn(el("use", { href: "#sparkPath", fill: "#fff3c4" }),
  { x, y, vx: rand(-18, 18), vy: rand(-34, -66), life: rand(0.7, 1.2), scale: rand(0.35, 0.7), spin: rand(-120, 120) });
export const crumb = (x, y) => spawn(el("circle", { r: 2.6, fill: "#6fbe58" }),
  { x, y, vx: rand(-64, 64), vy: rand(-40, -92), life: 0.9, gravity: 280 });
export const tear = (x, y) => spawn(el("ellipse", { rx: 4, ry: 5.6, fill: "#a9d8ef", opacity: ".9" }),
  { x, y, vx: rand(-4, 4), vy: 10, life: 1.5, gravity: 220 });
export const tuft = (x, y) => spawn(el("circle", { r: rand(5, 9.5), fill: "#fffaf1", opacity: ".96" }),
  { x, y, vx: rand(-72, 72), vy: rand(-96, -18), life: rand(0.9, 1.6), gravity: 210, spin: rand(-90, 90) });
export const zzz = (x, y) => {
  const t = el("text", { fill: "#fff", "font-size": 22, "font-family": "Fredoka, sans-serif", opacity: ".8" });
  t.textContent = "z";
  spawn(t, { x, y, vx: 16, vy: -30, life: 2.4, grow: 0.6, spin: 10 });
};

/** Advance every live particle; drop the ones whose life ran out. */
export const stepParticles = (dt) => {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.age >= p.life) { p.node.remove(); parts.splice(i, 1); continue; }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
    const k = p.age / p.life;
    const sc = (p.scale + p.grow * k) * (1 + Math.sin(k * Math.PI) * 0.12);
    p.node.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(1)}) scale(${sc.toFixed(3)})`);
    p.node.setAttribute("opacity", (1 - k * k).toFixed(3));
  }
};
