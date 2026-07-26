// The way out of a place: the edges of the frame themselves.
//
// This replaces the signpost, and it is the Dofus/Wakfu answer to the same
// question. A signpost is a thing you read; an edge is a thing you walk off. The
// valley was already built for it — six places laid out as a filmstrip indexed by
// `road`, each one frame of a shared coordinate space — so "the next place east"
// was already a number, not a name. What was missing was that the border of the
// screen should say so.
//
// Three markers, at most: onward, back, and home. They sit at the frame's own
// bounds rather than at a hand-placed tile, so they land in the same place in every
// diorama and a new place gets them for nothing.
//
// ADJACENCY IS NOT STRICT, and that is deliberate. The two unlock branches open
// roads 0-2-4 and 1-3-5, so a player who only ever feeds him has la rivière and le
// pont open with la grange closed BETWEEN them. Strictly adjacent edges would leave
// that player walled in at the river with nowhere to go. So an edge means "onward,
// this way" and travel.toward() finds the nearest OPEN place in that direction — a
// closed place is simply not a stop yet, which is also how it reads.
import { el } from "../engine/svg.js";
import { clamp } from "../engine/math.js";
import { VB_X, VB_Y, VB_W, VB_H, project } from "../engine/camera.js";
import * as valley from "../world/valley.js";
import { roster } from "./registry.js";

// Where a marker sits in the frame. Band-local, so identical in every place.
const MID_Y = VB_Y + VB_H * 0.5;
const INSET = 40;
const HOME_AT = [VB_X + VB_W * 0.2, VB_Y + VB_H - 34];

const PAD = 42;      // the marker's drawn size in user units
const THUMB = 44;    // ...and the smallest it may ever be on screen, in pixels

/**
 * How much to grow a marker so a thumb can land on it.
 *
 * A diorama is authored in tile space and letterboxed to fit, so on a 320px phone
 * the projection scale is about 0.44 — which drew these at 18px. That is reachable,
 * and the geometry sweep said so, but 18px is not something anybody taps on purpose.
 * The meadow props already solve this shape of problem (scenery.propScale), so the
 * same trick: ask the browser for its own matrix and counter-scale.
 *
 * Never shrinks. On a wide screen 42 units is already comfortably past a thumb, and
 * markers that got smaller as the window grew would be the opposite of the point.
 */
const thumbScale = () => clamp(THUMB / (PAD * (project().sc || 1)), 1, 2.8);

/** The nearest open place in a direction, or null. The same rule travel uses, asked
 *  here so a marker is only drawn when it leads somewhere. */
const onward = (me, dir) => roster()
  .filter((p) => p !== me && valley.opened(p.id) && Math.sign(p.road - me.road) === dir)
  .sort((a, b) => Math.abs(a.road - me.road) - Math.abs(b.road - me.road))[0] ?? null;

/**
 * One marker: a chevron at the border, and the name of what is past it.
 *
 * The name is hidden until you look at it. Six places all shouting their names at
 * the edges of every frame would be the clutter the signpost was already close to
 * — an arrow is enough to say "this way", and the name is there the moment you
 * hover, focus or read it with a screen reader.
 */
const marker = (into, x, y, dir, label, aria, onPick) => {
  const g = el("g", { class: "edge", tabindex: "0", role: "button", "data-dir": String(dir) });
  g.setAttribute("aria-label", aria);
  g.dataset.x = String(x);
  g.dataset.y = String(y);

  // Two nested groups on purpose. The outer one is PLACED with a transform
  // attribute; a CSS transform on the same element replaces that attribute rather
  // than composing with it, so a hover lean applied here would drop every marker at
  // the origin. Same trap the flowers in scenery.js are nested to avoid.
  const lean = el("g", { class: "edge__lean" });
  g.appendChild(lean);

  // a soft cartouche behind the chevron, so it reads on grass, stone and water alike
  lean.appendChild(el("rect", {
    class: "edge__pad", x: -21, y: -21, width: 42, height: 42, rx: 15,
  }));
  // dir: -1 west, +1 east, 0 home (down toward the camera)
  const tip = dir === 0 ? "0,11 -10,-3 10,-3" : dir > 0 ? "11,0 -3,-10 -3,10" : "-11,0 3,-10 3,10";
  lean.appendChild(el("polygon", { class: "edge__arrow", points: tip }));
  // ...and a second, fainter chevron behind it: two marks read as motion, one reads
  // as a button, and this is a direction rather than a control
  const trail = dir === 0 ? "0,3 -7,-7 7,-7" : dir > 0 ? "3,0 -7,-7 -7,7" : "-3,0 7,-7 7,7";
  lean.appendChild(el("polygon", { class: "edge__trail", points: trail }));

  const pick = (e) => { e.preventDefault?.(); e.stopPropagation?.(); onPick(); };
  g.addEventListener("pointerdown", pick);
  g.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") pick(e); });
  into.appendChild(g);

  // The name is a SIBLING, not a child, and that is not tidiness — an SVG group's
  // box is the union of its children, so a label inside it inflated the marker from
  // 42x42 to 156x56 even at opacity 0. The centre of that box then sat on empty air
  // beside the chevron: a tap aimed at the middle of the thing hit the hills behind
  // it, and travel simply never fired. Kept adjacent so CSS can still light it up
  // from the marker's own hover and focus.
  const text = el("text", {
    class: "edge__name",
    x: (x + (dir === 0 ? 0 : dir > 0 ? -30 : 30)).toFixed(1),
    y: (y + (dir === 0 ? -30 : 5)).toFixed(1),
    "text-anchor": dir === 0 ? "middle" : dir > 0 ? "end" : "start",
    "font-size": 15, "font-family": "var(--display)",
  });
  text.textContent = label;
  into.appendChild(text);
};

/**
 * Put the edges on a diorama.
 *  `me`     — the place they belong to, so onward is measured from its road
 *  `groundY` — the user-space floor line he stands on here, so a door is on it
 *  `onGo`   — walk to a place id
 *  `onHome` — leave the valley for the meadow
 *
 * Returns `sync()` to redraw them from what is open now, and `doorAt(dir)` — where
 * he sets off from and arrives at, which is the edge he is actually using rather
 * than one shared point per place. Leaving east now starts at the east border and
 * lands on the next place's west one.
 */
export const edges = (scene, me, groundY, onGo, onHome) => {
  const g = el("g", { class: "edges" });
  // filed at a depth past anything a place draws, so the markers are never behind
  // a bale, a bell rope or a hen
  scene.layers.add(g, () => 99, `edges-${me.id}`);

  /** Where he sets off from and arrives at, just inside the border he is crossing.
   *  A user-space point, like every doorway before it — `groundY` is the place's own
   *  floor line, passed in, because a barn floor and a ledge are at different
   *  heights and he must stand on whichever one he is actually on. */
  const doorAt = (dir = 0) => [
    dir === 0 ? HOME_AT[0] : dir > 0 ? VB_X + VB_W - INSET : VB_X + INSET,
    groundY,
  ];

  /** Place every marker, at whatever size a thumb needs right now. The scale goes
   *  in the SAME transform as the position — one attribute, so they cannot disagree
   *  — and the CSS hover lean stays on the inner group where it composes. */
  const rescale = () => {
    const k = thumbScale();
    for (const m of g.querySelectorAll(".edge")) {
      m.setAttribute("transform",
        `translate(${Number(m.dataset.x).toFixed(1)} ${Number(m.dataset.y).toFixed(1)}) scale(${k.toFixed(3)})`);
    }
  };
  // a rotated phone changes the projection without changing the board
  addEventListener("resize", rescale);

  return {
    node: g,
    doorAt,
    rescale,
    /** Rebuild from what is open now. Cheap, and called on arrival, so a place that
     *  opens while he is out has an edge leading to it when he gets back. */
    sync: () => {
      g.replaceChildren();
      for (const dir of [-1, 1]) {
        const next = onward(me, dir);
        if (!next) continue;
        marker(g, dir > 0 ? VB_X + VB_W - INSET : VB_X + INSET, MID_Y, dir,
          next.label[0],
          `${dir > 0 ? "Continuer vers" : "Revenir vers"} ${next.label[0]} — ${dir > 0 ? "onward to" : "back to"} ${next.label[1]}`,
          () => onGo(next.id));
      }
      // Home is always here, in every phase. "Any place can be left at any moment"
      // is a rule of this game, and the moment you have just solved a puzzle is the
      // worst possible one to take the way out away from someone.
      marker(g, HOME_AT[0], HOME_AT[1], 0, "le pré",
        "Revenir au pré — back to the meadow", onHome);
      rescale();
      g.style.display = "";
    },
  };
};
