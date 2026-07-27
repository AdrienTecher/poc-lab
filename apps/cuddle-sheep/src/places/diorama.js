// A diorama is one frame of the filmstrip: two groups in the shared layers,
// already shifted to this place's stretch of the road, plus everything a place
// needs to draw into them.
//
// Because the shift lives in a group transform, every place authors its art
// from tile zero and never has to know where on the road it sits.
//
// A band that is not live is DETACHED, not merely hidden, and that is load
// bearing. `overflow:hidden` on an <svg> clips to the element's CSS box, not to
// the viewBox rect — so with xMidYMid meet the letterbox margins paint live
// user space either side of the frame. Measured: 112 units of bleed at
// 1280x800, 317 at ultrawide, 359 at phone-landscape, against a pitch of 728.
// The next diorama along would simply be on screen, on six of the ten viewports
// the suite covers, and nothing would have failed. Detaching also costs a
// sleeping place nothing: no paint, no hit-test, no tab stop.
import { $, el } from "../engine/svg.js";
import { depthLayers } from "../engine/depth.js";
import { PITCH } from "../engine/camera.js";
import { host } from "../world/host.js";
import { active } from "./registry.js";

const back = $("#valleyBack"), front = $("#valleyFront");

/** Two bands and their tools. `id` names them for the DOM; `frame` is the
 *  place's index on the road. */
export const dioramaFor = (id, frame) => {
  // built detached: a place is out of the document until he goes there
  const band = (role) => el("g", {
    id: `${role}-${id}`,
    "data-layer": role,
    transform: `translate(${frame * PITCH} 0)`,
  });
  const backBand = band("back"), frontBand = band("front");

  // decor goes in first and is never re-filed, so it stays behind every piece.
  // It is aria-hidden, and the pieces are its SIBLINGS rather than its children
  // — filing an actor into an aria-hidden subtree would take it out of the
  // accessibility tree while leaving it visible and focusable.
  const decor = el("g", { "aria-hidden": "true" });
  backBand.appendChild(decor);

  let live = false;

  return {
    back: backBand,
    front: frontBand,
    decor,
    layers: depthLayers(backBand, frontBand),
    /** On screen, or out of the document entirely. Both bands of a place he is
     *  walking towards go live before the pan starts, so you see where you are
     *  going; the one he left goes dark on arrival. */
    show: (on) => {
      if (on === live) return;
      live = on;
      if (on) { back.appendChild(backBand); front.appendChild(frontBand); }
      else { backBand.remove(); frontBand.remove(); }
    },
    /** Seen from next door: on screen, but not somewhere you are.
     *
     *  `inert` is doing the real work — a live band brings its bales and bell ropes
     *  with it, and without this they would be clickable and tabbable from a place
     *  away. It takes the whole subtree out of hit-testing AND out of the
     *  accessibility tree, which is exactly what "you can see it but you are not
     *  there" means. The attribute is on the bands rather than a CSS rule, because
     *  there is no CSS for "not focusable".
     */
    peek: (on) => {
      for (const band of [backBand, frontBand]) {
        band.toggleAttribute("inert", on);
        band.classList.toggle("peeking", on);
      }
    },

    /** Put Nuage at a point in THIS place's tile space.
     *
     *  A place may try to move him after the player has walked away — a
     *  crossing still in flight, a timeout that outlived its board. Dropping it
     *  here is what makes "leave at any moment" safe without every place
     *  having to guard every call site. */
    host: (ux, uy) => { if (active()?.id === id) host(ux + frame * PITCH, uy); },
  };
};
