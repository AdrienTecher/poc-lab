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
