// Where your hand is, in his coordinates.
//
// Everything he does with his eyes and his body reads this: the gaze, the lean,
// the flinch away from fast hands. The speed is smoothed rather than sampled,
// because a single fast frame is not a fast hand.
import { lerp, now } from "../engine/math.js";
import { $ } from "../engine/svg.js";
import { state } from "../state.js";

const svg = $("#sheep");

export const ptr = { x: 200, y: 200, inside: false, speed: 0, at: now(), px: 200, py: 200 };
/** The last screen-space position, for the things drawn outside the SVG: the
 *  dragged clover and the shears cursor. */
export const lastClient = { x: innerWidth / 2, y: innerHeight / 2 };

// The screen→SVG matrix is cached: reading it per pointermove costs a layout,
// and it only changes when the page does.
let ctm = null;
export const refreshCTM = () => { ctm = svg.getScreenCTM(); };
addEventListener("resize", refreshCTM);
refreshCTM();

export const toSvg = (e) => {
  if (!ctm) refreshCTM();
  const p = svg.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(ctm.inverse());
};

/** Fold a pointer event into the model, and hand back the point in his space. */
export const track = (e) => {
  const p = toSvg(e);
  ptr.x = p.x; ptr.y = p.y; ptr.inside = true;
  lastClient.x = e.clientX; lastClient.y = e.clientY;
  const dtp = Math.max(0.008, now() - ptr.at);
  ptr.speed = lerp(ptr.speed, Math.hypot(p.x - ptr.px, p.y - ptr.py) / dtp, 0.3);
  ptr.at = now(); ptr.px = p.x; ptr.py = p.y;
  state.lastPointer = now();
  return p;
};

/** A hand that has stopped moving is not a fast hand any more. */
export const decay = (dt) => {
  if (now() - ptr.at > 0.12) ptr.speed *= Math.max(0, 1 - dt * 6);
};

/** Any sign of attention resets the doze clock. Lives here because attention is
 *  what the pointer is: touching him, dragging him a clover, startling a
 *  butterfly are all the same signal to a sheep who was about to fall asleep. */
export const poke = () => { state.lastPoke = now(); state.dozing = false; };
