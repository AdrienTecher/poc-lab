// What you can see of next door, from where you are standing.
//
// Dofus solved this in its 16:9 rework by drawing a live slice of the adjacent map
// into the border strip — real scenery in its real state, no NPCs. This does the same
// thing and pays nothing for it, because the border strip is already there and already
// empty: a 728-unit frame fitted with `meet` into a wider layer leaves letterbox
// margins either side — 150px at 1280x800, 595px at ultrawide — and those margins are
// exactly where the neighbour lands.
//
// Invariant 9 exists because of this. A sleeping diorama LEAVES the document precisely
// so that bleed cannot happen, since overflow:hidden clips to the CSS box and not to
// the viewBox. So the invariant is not deleted here, it is narrowed: bleed is
// forbidden by accident, and permitted where a neighbour is deliberately being shown.
// Everything further than one step away is still detached, and still for that reason.
//
// The neighbours are INERT. That is the part that would otherwise be a bug rather than
// a feature: a live band brings its bales, its bell ropes and its hens with it, and
// they would be clickable and tabbable from a place away. `inert` takes a whole
// subtree out of hit-testing and out of the accessibility tree in one attribute, which
// is what "you can see it but you are not there" should mean.
//
// They also do not animate. Only the mounted place gets frame() called on it, so a
// neighbour is a still — which is what Dofus shows too, and what keeps three live
// dioramas costing what one did.
import * as valley from "../world/valley.js";
import { roster } from "./registry.js";

/** The nearest open place either side, which is what a peek can reach. */
const beside = (me) => [-1, 1]
  .map((dir) => roster()
    .filter((p) => p !== me && valley.opened(p.id) && Math.sign(p.road - me.road) === dir)
    .sort((a, b) => Math.abs(a.road - me.road) - Math.abs(b.road - me.road))[0])
  .filter(Boolean);

/**
 * Settle the view around the place he is in: its neighbours visible and inert,
 * everything else out of the document.
 *
 * Called on arrival rather than on departure, because travel deliberately keeps the
 * place he LEFT awake for the whole walk — sleeping it early would empty the frame
 * behind him halfway across.
 */
export const settle = (me) => {
  if (!me) return;
  const near = beside(me);
  for (const p of roster()) {
    if (p === me) { p.peek?.(false); continue; }
    if (near.includes(p) && valley.opened(p.id)) {
      p.wake();
      // one frame at dt=0 files its pieces into the DOM without advancing anything:
      // depth.js only inserts a piece on the first sort(), which lives in frame()
      p.frame(0, 0);
      p.peek?.(true);
    } else {
      p.sleep();
    }
  }
};

/** Everything away: leaving the valley for the meadow. */
export const clear = () => {
  for (const p of roster()) { p.peek?.(false); p.sleep(); }
};
