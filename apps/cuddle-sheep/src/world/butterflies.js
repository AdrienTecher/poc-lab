// Idle company, and something for his eyes to follow.
//
// One is always out; the others only come when the sun does, which makes a
// happy meadow visibly busier without a single new mechanic.
import { $, el } from "../engine/svg.js";
import { rand } from "../engine/math.js";
import { sfx } from "../engine/audio.js";
import { poke } from "./pointer.js";

const TINT = ["#ffd9f0", "#fff3b8", "#dbeaff"];
const butterflies = [];

/** The one he watches: the first that is out. */
export const flying = () => butterflies.find((b) => b.alive);

export const build = () => {
  const layer = $("#butterflies");
  for (const i of [...Array(3).keys()]) {
    const g = el("g", { class: "bfly", cursor: "pointer" });
    const wing = (sx) => {
      const w = el("g", { fill: TINT[i], opacity: ".95" });
      w.append(
        el("ellipse", { cx: sx * 9, cy: -5, rx: 9.5, ry: 11 }),
        el("ellipse", { cx: sx * 7.5, cy: 7, rx: 7, ry: 8 }),
      );
      return w;
    };
    const wingL = wing(-1), wingR = wing(1);
    g.append(wingL, wingR, el("ellipse", { rx: 2.4, ry: 9, fill: "#5b4a55" }),
      el("path", { d: "M-1,-8 C-4,-14 -7,-15 -9,-16 M1,-8 C4,-14 7,-15 9,-16", stroke: "#5b4a55", "stroke-width": 1.4, fill: "none", "stroke-linecap": "round" }));
    layer.appendChild(g);
    const b = { node: g, wingL, wingR, x: 200, y: 150, seed: rand(0, 100), speed: rand(0.22, 0.4), flee: 0, alive: i === 0 };
    g.addEventListener("pointerdown", (e) => { e.stopPropagation(); b.flee = 2.6; poke(); sfx.flutter(); });
    butterflies.push(b);
  }
};

export const step = (dt, t, m) => {
  butterflies.forEach((b, i) => {
    b.alive = i === 0 || m > 0.35;
    b.node.setAttribute("opacity", b.alive ? "1" : "0");
    if (!b.alive) return;
    if (b.flee > 0) {
      b.flee -= dt;
      b.y -= 130 * dt;
      b.x += Math.sin(t * 6 + i) * 70 * dt;
      if (b.y < -70) { b.y = 320; b.flee = 0; }
    } else {
      b.x = 200 + Math.sin(t * b.speed + b.seed) * 215 + Math.sin(t * b.speed * 2.3 + b.seed) * 45;
      b.y = 118 + Math.cos(t * b.speed * 1.4 + b.seed) * 62 + Math.sin(t * b.speed * 3.1) * 14;
    }
    const flap = Math.abs(Math.sin(t * 11 + i));
    b.node.setAttribute("transform",
      `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${(Math.sin(t * b.speed + b.seed) * 12).toFixed(1)}) scale(${(0.72 + i * 0.08).toFixed(2)})`);
    b.wingL.setAttribute("transform", `scale(${(0.4 + flap * 0.6).toFixed(2)} 1)`);
    b.wingR.setAttribute("transform", `scale(${(0.4 + flap * 0.6).toFixed(2)} 1)`);
  });
};
