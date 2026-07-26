// The camera is one number.
//
// Every diorama in the valley is drawn into the same pair of SVG layers — one
// frame of a filmstrip each — so "where we are looking" is the min-x of the
// viewBox those two layers share. Panning is a spring on a single scalar.
//
// That is not a tidiness argument, it is the safety argument: the sheep is a
// DOM element outside those layers whose screen position is *derived* from this
// same number, read in the same frame it is painted. There is no second source
// of truth for where the world is, so he cannot slide out of it mid-pan.
import { $ } from "./svg.js";
import { REDUCED } from "./math.js";
import { springs, S, set, v } from "./spring.js";

export const VB_X = 196, VB_Y = 44, VB_W = 728, VB_H = 452;   // must match index.html
export const PITCH = VB_W;     // one frame: two dioramas are never on screen at once
export const MOUTON_W = 186;   // Nuage's worn width in user units; every diorama scales off him

const back = $("#valleyBack"), front = $("#valleyFront");

// ζ = 12.7 / (2√40) = 1.004 — just overdamped, so a pan arrives without a
// bounce and settles in about a second
S("camX", VB_X, 40, 12.7);

/** The viewBox min-x that frames a given place. */
export const home = (frame) => VB_X + frame * PITCH;

export const panTo = (frame, snap = REDUCED) => {
  const x = home(frame);
  set("camX", x);
  if (snap) { springs.camX.v = x; springs.camX.vel = 0; }
};

export const at = () => v("camX");
export const still = () => Math.abs(springs.camX.vel) < 6 && Math.abs(at() - springs.camX.target) < 2;

/** The live mapping from shared user units to client pixels.
 *
 *  This is not a reimplementation of the letterbox solve — it is the browser's
 *  own answer, the very matrix it used to paint the polygons a moment ago. For
 *  an outer <svg> with a viewBox and xMidYMid meet, getScreenCTM() is exactly
 *  [sc 0 0 sc ox oy]. Asking for it rather than deriving it is what makes the
 *  sheep track a pan by construction instead of by agreement: the camera IS the
 *  viewBox, so the camera is already in this matrix.
 *
 *  Read fresh every frame rather than cached. It costs one layout flush the rig
 *  was already paying, and a cached matrix is a stale matrix the first time a
 *  phone is rotated in the middle of a pan. */
export const project = () => {
  const m = back.getScreenCTM();
  return m ? { sc: m.a, ox: m.e, oy: m.f } : { sc: 1, ox: 0, oy: 0 };
};

let wrote = -1;
/** Write the camera into both layers. An idle frame touches no attribute, so a
 *  parked camera never invalidates the raster — the cost exists only while a
 *  pan is actually running. */
export const paint = () => {
  const x = at();
  if (Math.abs(x - wrote) < 0.05) return;
  wrote = x;
  const box = `${x.toFixed(1)} ${VB_Y} ${VB_W} ${VB_H}`;
  back.setAttribute("viewBox", box);
  front.setAttribute("viewBox", box);
};
