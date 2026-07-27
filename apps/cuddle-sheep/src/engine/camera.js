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

// ...and how WIDE the shot is. At VB_W it is one place, which is every case except
// the map; widening it reveals the neighbouring frames, because every diorama is
// drawn into this one coordinate space rather than into a scene of its own. That is
// the whole reason a map here can be the valley itself instead of a picture of it.
S("camW", VB_W, 26, 10.4);

/** The viewBox min-x that frames a given place, at the ordinary width. */
export const home = (frame) => VB_X + frame * PITCH;

/** The centre of a place's frame, which is what a variable-width shot aims at. */
export const centre = (frame) => VB_X + frame * PITCH + VB_W / 2;

/** Aim the shot: where its middle is, and how much of the valley it holds. */
export const view = (centreX, width, snap = REDUCED) => {
  set("camW", width);
  set("camX", centreX - width / 2);
  if (snap) {
    springs.camW.v = width; springs.camW.vel = 0;
    springs.camX.v = centreX - width / 2; springs.camX.vel = 0;
  }
};

export const width = () => v("camW");
export const wide = () => v("camW") > VB_W * 1.02;

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

let wroteX = -1, wroteW = -1;
/** Write the camera into both layers. An idle frame touches no attribute, so a
 *  parked camera never invalidates the raster — the cost exists only while a
 *  pan is actually running.
 *
 *  The HEIGHT does not follow the width, and that is the whole trick of the wide
 *  shot. Growing both preserves the aspect ratio and then `meet` letterboxes on
 *  whichever axis is tighter — which at six frames wide was the height, so the
 *  valley came out at 0.21 scale with most of the screen empty. Holding the height
 *  at VB_H makes the box wide and flat, `meet` fits it to the WIDTH instead, and the
 *  places are as large as the screen can make them. A diorama is 452 tall in its own
 *  frame, so nothing is ever cropped. */
export const paint = () => {
  const x = at(), w = v("camW");
  if (Math.abs(x - wroteX) < 0.05 && Math.abs(w - wroteW) < 0.05) return;
  wroteX = x; wroteW = w;
  const box = `${x.toFixed(1)} ${VB_Y} ${w.toFixed(1)} ${VB_H}`;
  back.setAttribute("viewBox", box);
  front.setAttribute("viewBox", box);
};
