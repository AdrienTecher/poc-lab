// Which diorama is on screen. Exactly one at a time; the meadow is "none".
//
// It imports nothing on purpose. Everything that needs to know whether he is
// away — the doze clock, the keyboard, the hint that asks for another cuddle —
// asks here, and a place that wants to be entered mounts itself. That keeps the
// question "where is he?" from being answered by the puzzle he happens to be in.
let mounted = null;

export const active = () => mounted;

export const mount = (place) => {
  mounted = place;
  document.documentElement.dataset.mode = place.mode;
};

export const unmount = () => {
  mounted = null;
  delete document.documentElement.dataset.mode;
};
