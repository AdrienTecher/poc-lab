// A diorama is one frame of the filmstrip: two groups in the shared layers,
// already shifted to this place's stretch of the road, plus everything a place
// needs to draw into them.
//
// Because the shift lives in a group transform, every place authors its art
// from tile zero and never has to know where on the road it sits.
import { $, el } from "../engine/svg.js";
import { depthLayers } from "../engine/depth.js";
import { PITCH } from "../engine/camera.js";
import { host } from "../world/host.js";
import { active } from "./registry.js";

const back = $("#valleyBack"), front = $("#valleyFront");

/** Two bands and their tools. `id` names them for the DOM; `frame` is the
 *  place's index on the road. */
export const dioramaFor = (id, frame) => {
  const band = (parent, role) => {
    const g = el("g", {
      id: `${role}-${id}`,
      "data-layer": role,
      transform: `translate(${frame * PITCH} 0)`,
    });
    parent.appendChild(g);
    return g;
  };
  const backBand = band(back, "back"), frontBand = band(front, "front");

  // decor goes in first and is never re-filed, so it stays behind every piece
  const decor = el("g", { "aria-hidden": "true" });
  backBand.appendChild(decor);

  return {
    back: backBand,
    front: frontBand,
    decor,
    layers: depthLayers(backBand, frontBand),
    /** Put Nuage at a point in THIS place's tile space.
     *
     *  A place may try to move him after the player has walked away — a
     *  crossing still in flight, a timeout that outlived its board. Dropping it
     *  here is what makes "leave at any moment" safe without every place
     *  having to guard every call site. */
    host: (ux, uy) => { if (active()?.id === id) host(ux + frame * PITCH, uy); },
  };
};
