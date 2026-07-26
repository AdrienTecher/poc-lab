// The four numbers everything else is built out of.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);

/** Seconds since load. The rig runs on this; the two clocks run on Date.now(). */
export const now = () => performance.now() / 1000;

export const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
