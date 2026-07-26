// One save file, one place that knows its shape.
//
// The clocks ARE the game, so the rules here are strict: a save may never
// rewind a clock, and a save that cannot be read must open onto a fresh meadow
// rather than a broken one. A comfort toy does not greet you with an error.

const KEY = "nuage:save";
const VERSION = 4;
const THROTTLE = 500;

// The meadow: where a new sheep starts, and where a save that has lost track of
// him puts him back. A place id rather than a null, so "where is he" has one
// answer everywhere instead of a special case for home.
export const HOME = "pre";

// v1 was five loose keys written by hand from wherever needed them
const V1 = {
  happyUntil: "nuage:happy-until",
  woolFrom: "nuage:wool-from",
  fed: "nuage:clovers-fed",
  unlocked: "nuage:unlocked",
  crossings: "nuage:crossings",
};

const read = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* private mode: he simply forgets */ }
};
const drop = (key) => {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
};
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const ids = (v) => (Array.isArray(v) ? v.filter((id) => typeof id === "string") : []);

const fresh = () => ({
  v: VERSION,
  sheep: { happyUntil: 0, woolFrom: 0 },
  care: { fed: 0, shorn: 0 },
  valley: { at: HOME, visited: [HOME], unlocked: [], solves: {}, boards: {} },
  prefs: { sound: true },
});

/** Fold a parsed blob onto a fresh one, so a save written by an older build —
 *  missing a section this build expects — still opens. This IS the upgrade
 *  path: no field has ever changed meaning, so an older blob grafted onto a
 *  fresh one carries everything it knew and defaults everything it did not. */
const graft = (blob) => {
  const base = fresh();
  if (!blob || typeof blob !== "object") return base;
  const valley = blob.valley && typeof blob.valley === "object" ? blob.valley : {};
  const at = typeof valley.at === "string" && valley.at ? valley.at : HOME;
  // he has necessarily been where he is, and has necessarily been home
  const visited = [...new Set([HOME, ...ids(valley.visited), at])];
  return {
    v: VERSION,
    sheep: {
      happyUntil: num(blob.sheep?.happyUntil),
      woolFrom: num(blob.sheep?.woolFrom),
    },
    care: { fed: num(blob.care?.fed), shorn: num(blob.care?.shorn) },
    valley: {
      at,
      visited,
      unlocked: ids(valley.unlocked),
      // a board is opaque here: only the puzzle that wrote it knows its shape,
      // and a shape this build does not recognise is dropped by that puzzle
      boards: valley.boards && typeof valley.boards === "object" ? { ...valley.boards } : {},
      solves: Object.fromEntries(
        Object.entries(valley.solves && typeof valley.solves === "object" ? valley.solves : {})
          .map(([place, count]) => [place, num(count)]),
      ),
    },
    prefs: { sound: blob.prefs?.sound !== false },
  };
};

const migrate = () => {
  if (!Object.values(V1).some((k) => read(k) !== null)) return null;
  const data = fresh();
  data.sheep.happyUntil = num(read(V1.happyUntil));
  data.sheep.woolFrom = num(read(V1.woolFrom));
  data.care.fed = num(read(V1.fed));
  if (num(read(V1.unlocked)) === 1) data.valley.unlocked.push("riviere");
  const solves = num(read(V1.crossings));
  if (solves) data.valley.solves.riviere = solves;
  return data;
};

const load = () => {
  const raw = read(KEY);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      // Backwards is repairable and forwards is not. A blob this build or an
      // older one wrote is grafted; a blob from a NEWER build is a shape we do
      // not understand, and half-reading it would build half a world. Starting
      // fresh is the kind failure.
      const v = parsed?.v;
      if (Number.isInteger(v) && v >= 1 && v <= VERSION) {
        const grafted = graft(parsed);
        // an upgraded save is written back at once, so the next build up only
        // ever has one version to climb
        if (v !== VERSION) write(KEY, JSON.stringify(grafted));
        return grafted;
      }
    } catch { /* fall through */ }
    return fresh();
  }
  const migrated = migrate();
  if (!migrated) return fresh();
  // write first, then clear: a storage that refuses the new blob must not also
  // have eaten the old keys
  write(KEY, JSON.stringify(migrated));
  if (read(KEY) !== null) for (const key of Object.values(V1)) drop(key);
  return migrated;
};

export const data = load();

let wrote = 0;
let pending = false;

/** Persist. Called on every change, so it throttles; `force` skips the throttle
 *  for the beats that must not be lost (a fleece coming off, a puzzle solved). */
export const touch = (force = false) => {
  if (!force && Date.now() - wrote < THROTTLE) { pending = true; return; }
  wrote = Date.now();
  pending = false;
  write(KEY, JSON.stringify(data));
};

addEventListener("pagehide", () => { if (pending) touch(true); });
