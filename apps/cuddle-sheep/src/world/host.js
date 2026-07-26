// The one writer of where the sheep stands on screen.
//
// He is a DOM element sitting between two SVG layers, so "standing in a
// diorama" is three CSS variables on .stage rather than a transform inside the
// drawing. A place says where he is in tile space; this turns that into pixels,
// and it is deliberately the only thing that knows how.
import { $ } from "../engine/svg.js";
import { project, MOUTON_W } from "../engine/camera.js";

const stage = $("#stage");

export const host = (ux, uy) => {
  const { sc, ox, oy } = project();
  const w = stage.offsetWidth || 1, h = w * 372 / 400;
  stage.style.setProperty("--k", (MOUTON_W * sc / w).toFixed(4));
  stage.style.setProperty("--x", `${(ox + ux * sc - w / 2).toFixed(1)}px`);
  // 94.35% is his hoof line, so the scale pivots on his feet and nothing drifts
  stage.style.setProperty("--y", `${(oy + uy * sc - h * 0.9435).toFixed(1)}px`);
};

/** Hand him back to the meadow, which stands him up with plain CSS. */
export const unhost = () => {
  for (const key of ["--x", "--y", "--k"]) stage.style.removeProperty(key);
};
