// The path at the edge of a place, and the sign that names what is down it.
//
// A road is only drawn once its far end is open — an unopened way is not a
// greyed-out button, it simply is not there yet, the same rule the sprout and
// the gate already follow. Keys only ever open.
import { el } from "../engine/svg.js";
import { isoX, isoY, pt } from "../engine/iso.js";
import * as valley from "../world/valley.js";

/** Add a way out of `scene` at tile (gx, gy), pointing `dir` (+1 east, -1 west)
 *  towards `to`. Returns the node so the place can hide it while it is busy. */
export const wayTo = (scene, gx, gy, dir, to, onGo) => {
  const g = el("g", { class: "way", tabindex: "0", role: "button" });
  g.setAttribute("aria-label", `Aller vers ${to.label[0]} — go to ${to.label[1]}`);

  // A signpost is a thin thing: a post, a plank and three flat stones, with a
  // lot of nothing between them. Without a solid target a click aimed straight
  // at it falls through the gaps to the sky behind. Same reason the clovers
  // carry one.
  const px = isoX(gx, gy), py = isoY(gx, gy, 0.02);
  g.appendChild(el("rect", {
    x: (px - 58).toFixed(1), y: (py - 62).toFixed(1),
    width: 116, height: 92, fill: "transparent",
  }));

  // the path itself: three flat stones leading off the edge of the diorama
  for (const i of [...Array(3).keys()]) {
    const sx = gx + dir * (i * 0.62), sy = gy + i * 0.16;
    g.appendChild(el("polygon", {
      class: "way__stone",
      points: [pt(sx - 0.3, sy - 0.22, 0.02), pt(sx + 0.3, sy - 0.22, 0.02),
        pt(sx + 0.3, sy + 0.22, 0.02), pt(sx - 0.3, sy + 0.22, 0.02)].join(" "),
      fill: "var(--iso-stone)",
    }));
  }

  // the sign: a post, a plank and an arrow, all facing the way you would walk
  const sign = el("g", { transform: `translate(${px.toFixed(1)} ${(py - 4).toFixed(1)})` });
  sign.appendChild(el("ellipse", { cx: 0, cy: 0, rx: 8, ry: 4, fill: "#2c3a2e", opacity: ".18" }));
  sign.appendChild(el("rect", { x: -2.4, y: -50, width: 4.8, height: 50, rx: 2, fill: "var(--iso-wood-r)" }));
  const plank = el("g", { transform: `translate(${dir * 13} -42)` });
  plank.appendChild(el("polygon", {
    points: dir > 0 ? "-14,-8 8,-8 16,0 8,8 -14,8" : "14,-8 -8,-8 -16,0 -8,8 14,8",
    fill: "var(--iso-wood)", stroke: "var(--iso-wood-r)", "stroke-width": 1.4,
  }));
  sign.appendChild(plank);
  g.appendChild(sign);

  scene.layers.add(g, () => gx + gy, `way-${to.id}`);
  const walk = (e) => { e.preventDefault?.(); e.stopPropagation?.(); onGo(to.id); };
  g.addEventListener("pointerdown", walk);
  g.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") walk(e); });

  return {
    node: g,
    /** A way you cannot yet take is not shown at all. */
    sync: (usable = true) => {
      const open = valley.opened(to.id);
      g.style.display = open ? "" : "none";
      g.setAttribute("tabindex", open && usable ? "0" : "-1");
      g.style.pointerEvents = open && usable ? "auto" : "none";
    },
  };
};
