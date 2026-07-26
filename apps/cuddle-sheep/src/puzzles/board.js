// What every puzzle in this valley has in common — which, after two of them,
// turns out to be exactly two things and not a framework.
//
// The temptation is a Puzzle base class taking a config object. Resisted: the
// crossing and the barn differ in their board, their moves, their readout, their
// failure and their choreography. What they genuinely share is a stack of past
// positions and the noise made when the last piece lands, so that is what is
// here. Everything else stays in the place, where it can be read next to the
// thing it draws.
import { rand } from "../engine/math.js";
import { kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { sparkle } from "../engine/particles.js";
import { state } from "../state.js";
import * as valley from "../world/valley.js";

/** Somewhere to put the positions you have been in, so a mistake is a rewind.
 *  A snapshot is whatever the puzzle says it is; this never looks inside one. */
export const history = () => {
  const past = [];
  return {
    push: (snapshot) => { past.push(snapshot); },
    pop: () => past.pop() ?? null,
    clear: () => { past.length = 0; },
    get depth() { return past.length; },
    /** For the save: the whole stack, and back again. */
    all: () => past.map((s) => s),
    load: (list) => { past.length = 0; if (Array.isArray(list)) past.push(...list); },
  };
};

/** The last piece lands. Chime, a hop, a shower, and a bleat that is the sad
 *  bleat if he is sad — winning does not override how he feels. The words are
 *  the place's own, because only it knows what was just finished. */
export const fanfare = (place) => {
  sfx.chime();
  kick("hop", -300);
  for (const i of [...Array(18).keys()]) setTimeout(() => sparkle(rand(140, 260), rand(170, 250)), 440 + i * 40);
  setTimeout(() => sfx.bleat(state.mood > 0.5), 900);
  valley.solve(place);
};
