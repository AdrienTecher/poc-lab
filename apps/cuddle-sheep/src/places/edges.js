// The way out of a place: a threshold laid into its ground.
//
// The Dofus/Wakfu system — you leave by the border of the screen — but drawn as
// part of the landscape rather than as chrome over it. An earlier pass put frosted
// glass cartouches at the frame's edges and it was wrong in a way worth recording:
// they were the HUD's material floating in world space, which is exactly the
// "navigation is a panel" this game had already decided against.
//
// So a way out is a THING NOW: flagstones set into the ground at the edge, worn
// pale where feet have crossed them, with a chevron cut into the slab pointing the
// way. Flat, in the 2:1 plane, mossy at the rim. The old
// signpost already had this vocabulary — it stood on `.way__stone` flat quads — so
// this is the same material with the post taken away.
//
// Two things follow from being in the landscape rather than over it:
//
//  * It is filed at its OWN depth (gx + gy) instead of in front of everything, so
//    it is occluded like any other piece. That is what embedded means.
//  * It cannot counter-scale for thumbs the way the glass version did, because a
//    floor decal that resizes breaks the perspective it is drawn in. The target is
//    a generous invisible rect instead: 150x96 user units, which still measures
//    over 40px on a 320px phone, and nothing visible is distorted.
//
// ADJACENCY IS NOT STRICT, and that is deliberate. The two unlock branches open
// roads 0-2-4 and 1-3-5, so a player who only ever feeds him has la rivière and le
// pont open with la grange closed BETWEEN them. Strictly adjacent thresholds would
// wall that player in at the river. So a threshold means "onward, this way" and
// travel.toward() finds the nearest OPEN place in that direction — a closed place is
// simply not a stop yet, which is also how it reads.
import { el } from "../engine/svg.js";
import { isoX, isoY, pt } from "../engine/iso.js";
import * as valley from "../world/valley.js";
import { roster } from "./registry.js";

// Half-extents of the slab, in tiles. Kept modest on purpose: at 1.05 a slab was
// 178 user units wide on screen, and three of those will not fit on a floor as
// shallow as le clocher's without overlapping each other. At this size a slab is
// 140x70, which needs 3.05 tiles of separation. The invisible target does not
// shrink with it, so nothing about tapping gets harder.
const HW = 0.78, HD = 0.50;

// The chevron, in screen space, before the scale(1 .5) lies it into the plane. West
// and east point along the screen's own axis rather than along a tile axis, because a
// tile axis in a 2:1 projection points diagonally and "onward" should not look like
// it goes uphill. Home points down-screen, out of the front of the frame.
const CHEV = {
  "-1": [[11, -15], [-9, 0], [11, 15]],
  1: [[-11, -15], [9, 0], [-11, 15]],
  0: [[-15, -11], [0, 9], [15, -11]],
};
/** The screen direction each chevron travels in, for offsetting the second one. */
const AIM = { "-1": [-1, 0], 1: [1, 0], 0: [0, 1] };

/** The nearest open place in a direction, or null. The same rule travel uses, asked
 *  here so a threshold is only laid where it leads somewhere. */
const onward = (me, dir) => roster()
  .filter((p) => p !== me && valley.opened(p.id) && Math.sign(p.road - me.road) === dir)
  .sort((a, b) => Math.abs(a.road - me.road) - Math.abs(b.road - me.road))[0] ?? null;

/** One flat stone, as an iso quad on the ground. */
const slab = (gx, gy, hw, hd, z, cls, fill) => el("polygon", {
  class: cls,
  points: [pt(gx - hw, gy - hd, z), pt(gx + hw, gy - hd, z),
    pt(gx + hw, gy + hd, z), pt(gx - hw, gy + hd, z)].join(" "),
  fill,
});

/**
 * A threshold at tile (gx, gy), on the ground at height z, pointing `dir`.
 *
 * The name is set into the slab but hidden until you look at it: three names
 * lettered across the ground of every frame is the clutter the signpost was already
 * close to, and a chevron says "this way" without any.
 */
const threshold = (into, gx, gy, z, dir, label, aria, onPick) => {
  const g = el("g", { class: "edge", tabindex: "0", role: "button", "data-dir": String(dir) });
  g.setAttribute("aria-label", aria);
  const px = isoX(gx, gy), py = isoY(gx, gy, z);

  // The target, and it is invisible on purpose. A slab is 150x83 user units of
  // screen extent, which is a comfortable mouse target and a marginal thumb one, so
  // the rect is squarer than the stone is. It sits at the edge of a frame where no
  // puzzle piece ever does, so there is nothing for it to steal a tap from.
  g.appendChild(el("rect", {
    x: (px - 75).toFixed(1), y: (py - 58).toFixed(1), width: 150, height: 96, fill: "transparent",
  }));

  // A dark rim first, then the slab inside it, so the stone reads as set INTO the
  // ground rather than resting on it. The rim is a translucent SHADOW rather than a
  // colour, on purpose: it was moss to begin with, which was charming on la clôture's
  // grass and plainly wrong on la grange's plank floor — moss is a living thing and a
  // flagstone is a made one. A shadow darkens whatever it happens to lie on, so one
  // rim works on grass, planks, tower stone and bare rock alike.
  const rim = slab(gx, gy, HW + 0.13, HD + 0.11, z + 0.002, "edge__rim", "#2f2a24");
  rim.setAttribute("opacity", ".24");
  g.appendChild(rim);
  g.appendChild(slab(gx, gy, HW, HD, z + 0.004, "edge__slab", "var(--edge-stone)"));
  // a paler patch down the middle: the part that has actually been walked on
  g.appendChild(slab(gx, gy, HW * 0.72, HD * 0.52, z + 0.006, "edge__worn", "var(--edge-worn)"));

  // The chevron, carved into the slab. A first pass set three small square stones
  // stepping along the direction and it read as scattered blocks — a square has no
  // pointy end, so nothing about it said "that way". A chevron does, so it is drawn
  // as one: two of them, in SCREEN space, inside a scale(1 .5) that lies them down
  // into the 2:1 plane. The squash thins the stroke vertically as well, which is
  // exactly what a mark cut into a floor and seen at this angle looks like.
  const marks = el("g", { transform: `translate(${px.toFixed(1)} ${py.toFixed(1)}) scale(1 .5)` });
  const [ux, uy] = AIM[String(dir)];
  for (const shift of [-11, 11]) {
    marks.appendChild(el("polyline", {
      class: "edge__mark",
      points: CHEV[String(dir)].map(([ax, ay]) => `${ax + ux * shift},${ay + uy * shift}`).join(" "),
      fill: "none", stroke: "var(--edge-cut)", "stroke-width": 8,
      "stroke-linecap": "round", "stroke-linejoin": "round",
    }));
  }
  g.appendChild(marks);

  const pick = (e) => { e.preventDefault?.(); e.stopPropagation?.(); onPick(); };
  g.addEventListener("pointerdown", pick);
  g.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") pick(e); });
  into.appendChild(g);

  // The name is a SIBLING, not a child, and that is not tidiness — an SVG group's
  // box is the union of its children, so a label inside it moved the group's centre
  // off the stone, and a tap aimed at the middle of the thing landed on the scenery
  // behind it. Kept adjacent so CSS can still light it up from the stone's own hover.
  const text = el("text", {
    class: "edge__name",
    x: px.toFixed(1), y: (py - 26).toFixed(1), "text-anchor": "middle",
    "font-size": 15, "font-family": "var(--display)",
  });
  text.textContent = label;
  into.appendChild(text);
};

/**
 * Lay the thresholds into a diorama.
 *  `me`    — the place they belong to, so onward is measured from its road
 *  `exits` — `{ z, west: [gx, gy], east: [gx, gy], home: [gx, gy] }` in TILE space.
 *            Per place, and it has to be: the ground is not flat everywhere, and a
 *            generic "middle of the west border" would lay a flagstone over le
 *            pont's gorge. Declared rather than derived, like every other bit of
 *            world geometry here.
 *  `onGo`   — walk to a place id
 *  `onHome` — leave the valley for the meadow
 *
 * Returns `sync()` to relay them from what is open now, and `doorAt(dir)` — the
 * threshold he actually sets off from and arrives at, so a walk east leaves by the
 * east stone and lands on the next place's west one.
 */
export const edges = (scene, me, exits, onGo, onHome) => {
  const g = el("g", { class: "edges" });
  const where = (dir) => (dir === 0 ? exits.home : dir > 0 ? exits.east : exits.west);

  // Filed at the depth of whichever stone is furthest forward, so the group is
  // ordered against the pieces like anything else in the diorama. A floor marker
  // that painted over a bale would not be in the floor.
  scene.layers.add(g, () => {
    const [gx, gy] = exits.home;
    return gx + gy;
  }, `edges-${me.id}`);

  const doorAt = (dir = 0) => {
    const [gx, gy] = where(dir);
    return [isoX(gx, gy), isoY(gx, gy, exits.z)];
  };

  return {
    node: g,
    doorAt,
    /** Relay them from what is open now. Cheap, and called on arrival, so a place
     *  that opens while he is out has a stone leading to it when he gets back. */
    sync: () => {
      g.replaceChildren();
      for (const dir of [-1, 1]) {
        const next = onward(me, dir);
        if (!next) continue;
        const [gx, gy] = where(dir);
        threshold(g, gx, gy, exits.z, dir, next.label[0],
          `${dir > 0 ? "Continuer vers" : "Revenir vers"} ${next.label[0]} — ${dir > 0 ? "onward to" : "back to"} ${next.label[1]}`,
          () => onGo(next.id));
      }
      // Home is always laid, in every phase. "Any place can be left at any moment"
      // is a rule of this game, and the moment you have just solved a puzzle is the
      // worst possible one to take the way out away from someone.
      threshold(g, exits.home[0], exits.home[1], exits.z, 0, "le pré",
        "Revenir au pré — back to the meadow", onHome);
      g.style.display = "";
    },
  };
};
