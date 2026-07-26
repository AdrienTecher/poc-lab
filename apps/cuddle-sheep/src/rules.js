// Every number that decides how the world behaves, in one place.
//
// The two clocks are the game. HAPPY_MS is sacred: nothing outside the mood
// system may lengthen, shorten, pause or gate it.

export const HAPPY_MS = 5 * 60 * 1000;      // a cuddle buys exactly five minutes
export const FADE_MS = 20 * 1000;           // ...the last twenty of which he droops through
export const PET_TARGET = 460;              // stroke distance (svg units) that fills one cuddle
export const DOZE_AFTER = 55;               // seconds of being ignored before he nods off

export const WOOL_FULL_MS = 15 * 60 * 1000; // shorn to full fleece, wall-clock, growing while away
export const SHEAR_TARGET = 760;            // shear-stroke distance that takes a full fleece off
export const WOOL_READY = 0.6;              // past here he is visibly overgrown and the shears glint
export const SHEAR_MIN = 0.2;               // below this there is nothing worth taking off
export const SHEAR_CALM = 0.62;             // he only holds still for the blades once he feels safe
export const FIRST_FLEECE = 0.45;           // a first visit starts mid-fleece: the look he shipped with

export const CLOVERS_TO_UNLOCK = 5;         // clovers eaten before the river puzzle opens
export const FLEECES_TO_UNLOCK = 3;         // fleeces shorn before the barn opens — they ARE the bales

/* ---- the day ----------------------------------------------------------- *
 * The only clock in the game with no stored state: it is read from the
 * player's own clock, so it cannot rewind and cannot be fallen behind on.
 * Sunrise and sunset by month, for the latitude the game is written in — a
 * declared table rather than a solar model, because the point is that the
 * meadow agrees with the window, and a table can be checked by looking. */
export const SUNRISE = [
  [8.7, 17.1], [8.1, 18.0], [7.1, 18.9], [6.9, 20.8], [6.0, 21.5], [5.8, 21.9],
  [6.1, 21.8], [6.8, 21.1], [7.5, 20.0], [8.3, 19.0], [8.1, 17.2], [8.7, 16.9],
];
export const SEASONS = [
  "hiver", "hiver", "printemps", "printemps", "printemps", "ete",
  "ete", "ete", "automne", "automne", "automne", "hiver",
];
export const GOLDEN = 0.34;      // solar altitude either side of the horizon that reads as golden

// How dark the night is allowed to get. NOT a taste value: a grade multiplies
// the distance between the happy and the sad palette as well as the palette
// itself, so this number is the one that decides whether --m still means
// anything after dark. It is set by measurement — see tests/day.spec.mjs — and
// night is when most people will actually be here, so it is set gently.
export const NIGHT_GRADE = 0.40;
export const DUSK_GRADE = 0.6;
