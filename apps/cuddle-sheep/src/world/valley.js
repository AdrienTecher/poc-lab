// What caring has earned: clovers eaten, places opened, puzzles solved.
//
// This is the one thing the meadow and the places both write, so it is also the
// one place that touches `save.data.care` and `save.data.valley`. Consumers
// subscribe rather than being called: the clover patch and the four-leaf sprout
// both want to know when something changes, and neither should have to be known
// by whatever changed it.
import * as save from "../engine/save.js";
import { state } from "../state.js";
import { CLOVERS_TO_UNLOCK } from "../rules.js";

const watchers = [];
export const watch = (fn) => { watchers.push(fn); };
const changed = () => { for (const fn of watchers) fn(); };

export const opened = (place) => save.data.valley.unlocked.includes(place);
export const solves = (place) => save.data.valley.solves[place] ?? 0;

/** One clover eaten. Capped: past the threshold the count means nothing more. */
export const eat = () => {
  state.fed = Math.min(state.fed + 1, CLOVERS_TO_UNLOCK);
  save.data.care.fed = state.fed;
  save.touch(true);
  changed();
};

/** Keys only ever open. Returns false if the place was already open. */
export const open = (place) => {
  if (opened(place)) return false;
  save.data.valley.unlocked.push(place);
  save.touch(true);
  changed();
  return true;
};

export const solve = (place) => {
  const n = solves(place) + 1;
  save.data.valley.solves[place] = n;
  save.touch(true);
  changed();
  return n;
};
