// The way out of a place — and the map.
//
// A valley is navigated by reading the sign at the crossroads, so that is what
// this is: a post, and a plank for every place you could walk to from here,
// each with its name on it. It costs no room in the HUD, it says where you can
// go without a legend, and it grows a plank per place rather than needing a
// panel. The bottom plank always points home.
//
// The sign is never disabled, in any phase. "Any place can be left at any
// moment" is a rule of this game, and the moment you have just solved a puzzle
// is the worst possible one to take the way home away from someone.
//
// A road is only drawn once its far end is open — an unopened way is not a
// greyed-out button, it simply is not there yet, the same rule the sprout and
// the gate already follow. Keys only ever open.
import { el } from "../engine/svg.js";
import { isoX, isoY, pt } from "../engine/iso.js";
import * as valley from "../world/valley.js";
import { roster } from "./registry.js";

const PLANK_H = 15, GAP = 4;
const STEP = PLANK_H * 2 + GAP;   // one plank's worth of post
const HEAD = 20;                  // bare post above the topmost plank
const FOOT = 14;                  // ...and below the bottom one, so it reads as planted

/** One plank: an arrow pointing the way, with the name of what is down it. */
const plank = (label, dir, y, onPick, aria) => {
  const w = 30 + label.length * 7.4;
  const g = el("g", { class: "way__plank", tabindex: "0", role: "button", transform: `translate(0 ${y})` });
  g.setAttribute("aria-label", aria);
  const tip = dir >= 0 ? w : -w;
  const neck = dir >= 0 ? w - 11 : -w + 11;
  g.appendChild(el("polygon", {
    class: "way__board",
    points: `${-tip * 0.12},${-PLANK_H} ${neck},${-PLANK_H} ${tip},0 ${neck},${PLANK_H} ${-tip * 0.12},${PLANK_H}`,
    fill: "var(--iso-wood)", stroke: "var(--iso-wood-r)", "stroke-width": 1.6,
  }));
  const text = el("text", {
    class: "way__name",
    x: (dir >= 0 ? w * 0.46 : -w * 0.46).toFixed(1), y: 4.6,
    "text-anchor": "middle", fill: "var(--iso-sign-ink)",
    "font-size": 14, "font-family": "var(--display)",
  });
  text.textContent = label;
  g.appendChild(text);
  const pick = (e) => { e.preventDefault?.(); e.stopPropagation?.(); onPick(); };
  g.addEventListener("pointerdown", pick);
  g.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") pick(e); });
  return g;
};

/**
 * Plant a signpost at tile (gx, gy) in `scene`.
 *  `me`    — the place it stands in, so it never lists where you already are
 *  `onGo`  — walk to a place id
 *  `onHome`— leave the valley for the meadow
 */
export const signpost = (scene, gx, gy, me, onGo, onHome) => {
  const g = el("g", { class: "way" });
  const px = isoX(gx, gy), py = isoY(gx, gy, 0.02);

  // three flat stones underfoot, so the sign stands on a path rather than in grass
  for (const i of [...Array(3).keys()]) {
    const sx = gx + (i - 1) * 0.5, sy = gy + Math.abs(i - 1) * 0.12;
    g.appendChild(el("polygon", {
      class: "way__stone",
      points: [pt(sx - 0.3, sy - 0.22, 0.02), pt(sx + 0.3, sy - 0.22, 0.02),
        pt(sx + 0.3, sy + 0.22, 0.02), pt(sx - 0.3, sy + 0.22, 0.02)].join(" "),
      fill: "var(--iso-stone)",
    }));
  }
  g.appendChild(el("ellipse", { cx: px.toFixed(1), cy: py.toFixed(1), rx: 9, ry: 4.5, fill: "#2c3a2e", opacity: ".2" }));

  const post = el("g", { transform: `translate(${px.toFixed(1)} ${py.toFixed(1)})` });
  const mast = el("rect", { x: -3, y: -104, width: 6, height: 104, rx: 3, fill: "var(--iso-wood-r)" });
  post.appendChild(mast);
  g.appendChild(post);

  const boards = el("g", { transform: `translate(${px.toFixed(1)} ${py.toFixed(1)})` });
  g.appendChild(boards);

  scene.layers.add(g, () => gx + gy, `way-${me.id}`);

  return {
    node: g,
    /** Rebuild the planks from what is open now. Cheap, and called on arrival,
     *  so a place that opens while he is out is on the sign when he gets back. */
    sync: () => {
      boards.replaceChildren();
      const open = roster()
        .filter((p) => p !== me && valley.opened(p.id))
        .sort((a, b) => a.road - b.road);

      // The POST is sized to its planks, rather than the planks being hung on a
      // post of a fixed height. It was written the other way round — a 104-unit
      // mast and a first plank at y = -86 — which was right at two places and
      // silently wrong at six: 170 units of board on a 104-unit post ran off the
      // bottom of the frame. And a plank outside the frame is worse than a clipped
      // one, because overflow:hidden hides it while leaving its bounding box where
      // it was, so it keeps a click target somewhere nobody can see, over the top
      // of the place's control bar. A sign with six ways on it is simply a taller
      // sign, which is also what one looks like.
      const n = open.length + 1;                       // + the plank home
      const height = Math.max(104, HEAD + (n - 1) * STEP + PLANK_H + FOOT);
      mast.setAttribute("y", String(-height));
      mast.setAttribute("height", String(height));

      let y = -height + HEAD + PLANK_H;
      for (const p of open) {
        const dir = Math.sign(p.road - me.road) || 1;
        boards.appendChild(plank(p.label[0], dir, y, () => onGo(p.id),
          `Aller vers ${p.label[0]} — go to ${p.label[1]}`));
        y += STEP;
      }
      // home is always the last plank, and always points back
      boards.appendChild(plank("le pré", -1, y, onHome, "Revenir au pré — back to the meadow"));
      g.style.display = "";
    },
  };
};
