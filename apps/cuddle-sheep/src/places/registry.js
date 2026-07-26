// Which diorama is on screen. Exactly one at a time; the meadow is "none".
//
// It imports nothing on purpose. Everything that needs to know whether he is
// away — the doze clock, the keyboard, the hint that asks for another cuddle —
// asks here, and a place that wants to be entered mounts itself. That keeps the
// question "where is he?" from being answered by the puzzle he happens to be in.
let mounted = null;

// Every place enrols itself here, and travel resolves destinations by id. That
// is what lets two places name each other without importing each other — a
// cycle that would otherwise deadlock at module-evaluation time.
const places = new Map();
export const enrol = (place) => { places.set(place.id, place); };
export const placeOf = (id) => places.get(id) ?? null;
export const roster = () => [...places.values()];

export const active = () => mounted;

// data-place is "he is somewhere" and every diorama shares its rules; data-mode
// is which one, and only genuinely per-place chrome keys on it.
export const mount = (place) => {
  mounted = place;
  document.documentElement.dataset.place = place.id;
  document.documentElement.dataset.mode = place.mode;
};

export const unmount = () => {
  mounted = null;
  delete document.documentElement.dataset.place;
  delete document.documentElement.dataset.mode;
};

/** He has set off for somewhere else. Nothing is mounted — so no place will
 *  accept input or try to move him while he is walking — but data-place stays,
 *  because the valley must not fade back to the meadow underneath him. Dropping
 *  data-mode takes the place's control bar off screen for the length of the
 *  journey, which is right: there is nothing to press while walking. */
export const depart = () => {
  mounted = null;
  delete document.documentElement.dataset.mode;
};
