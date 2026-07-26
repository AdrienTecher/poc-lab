// The hour of the day, as the world reads it.
//
// This is the only system in the game that stores nothing. It is derived from
// the player's own clock, so the meadow agrees with the room they are sitting
// in — and a clock with no state cannot rewind, cannot be fallen behind on, and
// needs no migration.
//
// It publishes three numbers and touches no colour. Every one of the forty
// --m mixes is left exactly as it was; the day is applied *over* the palette by
// two grades in styles.css, never inside it.
//
// The trap here is worth stating, because it is subtle and it nearly shipped: a
// multiply grade scales the happy colour and the sad colour by the same factor,
// so it scales the DISTANCE between them by that factor too — k·a − k·b =
// k(a−b). Mood is that distance. Push the grade far enough and --m, which is
// the spine of the entire look, goes quiet exactly when the player is most
// likely to be here. NIGHT_GRADE is therefore set by measurement, not by taste:
// tests/day.spec.mjs requires the sky's happy-vs-sad separation at 2am to stay
// above two thirds of its separation at noon.
import { clamp } from "../engine/math.js";
import { SUNRISE, GOLDEN, NIGHT_GRADE, DUSK_GRADE, SEASONS } from "../rules.js";

const root = document.documentElement;

/** Local hour as a fraction, 0…24. */
const hourNow = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
};

/** Signed solar altitude: +1 at midday, 0 at dawn and dusk, −1 in the middle of
 *  the night. Continuous across both crossings, which is all the sky needs. */
export const altitude = (h = hourNow(), month = new Date().getMonth()) => {
  const [dawn, dusk] = SUNRISE[month];
  if (h >= dawn && h <= dusk) return Math.sin(((h - dawn) / (dusk - dawn)) * Math.PI);
  const dark = 24 - (dusk - dawn);
  const since = ((h < dawn ? h + 24 : h) - dusk) / dark;
  return -Math.sin(since * Math.PI);
};

/** Where the lit body sits on its arc: 0 rising in the east, 1 setting west.
 *  Read only by geometry — never by a colour — which is why the day needs one
 *  scalar and not two. */
export const arc = (h = hourNow(), month = new Date().getMonth()) => {
  const [dawn, dusk] = SUNRISE[month];
  if (h >= dawn && h <= dusk) return (h - dawn) / (dusk - dawn);
  const dark = 24 - (dusk - dawn);
  return (((h < dawn ? h + 24 : h) - dusk) / dark);
};

export const season = (month = new Date().getMonth()) => SEASONS[month];

let wrote = -9;

/** Write the hour into the document. Cheap enough to call every frame; it only
 *  touches the DOM when the sky has visibly moved. */
export const step = () => {
  const alt = altitude();
  if (Math.abs(alt - wrote) < 0.002) return;
  wrote = alt;
  const day = clamp(alt, 0, 1), night = clamp(-alt, 0, 1);
  root.style.setProperty("--day", day.toFixed(3));
  root.style.setProperty("--night", night.toFixed(3));
  root.style.setProperty("--arc", arc().toFixed(3));
  // the golden hour is the band either side of the horizon, declared rather
  // than derived from a physical model nobody can check by looking
  root.style.setProperty("--dusk", clamp(1 - Math.abs(alt) / GOLDEN, 0, 1).toFixed(3));
  root.style.setProperty("--night-grade", String(NIGHT_GRADE));
  root.style.setProperty("--dusk-grade", String(DUSK_GRADE));
  const s = season();
  if (root.dataset.season !== s) root.dataset.season = s;
};
