// One save file, one place that knows its shape.
//
// The clocks ARE the game, so the rules here are strict: a save may never
// rewind a clock, and a save that cannot be read must open onto a fresh meadow
// rather than a broken one. A comfort toy does not greet you with an error.

const KEY = "nuage:save";
const VERSION = 2;
const THROTTLE = 500;

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

const fresh = () => ({
  v: VERSION,
  sheep: { happyUntil: 0, woolFrom: 0 },
  care: { fed: 0 },
  valley: { unlocked: [], solves: {} },
  prefs: { sound: true },
});

/** Fold a parsed blob onto a fresh one, so a save written by an older build —
 *  missing a section this build expects — still opens. */
const graft = (blob) => {
  const base = fresh();
  if (!blob || typeof blob !== "object") return base;
  const valley = blob.valley && typeof blob.valley === "object" ? blob.valley : {};
  return {
    v: VERSION,
    sheep: {
      happyUntil: num(blob.sheep?.happyUntil),
      woolFrom: num(blob.sheep?.woolFrom),
    },
    care: { fed: num(blob.care?.fed) },
    valley: {
      unlocked: Array.isArray(valley.unlocked) ? valley.unlocked.filter((id) => typeof id === "string") : [],
      solves: valley.solves && typeof valley.solves === "object" ? valley.solves : {},
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
      // An unknown version is not readable and not repairable. Starting fresh is
      // the kind failure: the alternative is a world half-built from a shape we
      // do not understand.
      if (parsed?.v === VERSION) return graft(parsed);
    } catch { /* fall through */ }
    return fresh();
  }
  const migrated = migrate();
  if (!migrated) return fresh();
  for (const key of Object.values(V1)) drop(key);
  write(KEY, JSON.stringify(migrated));
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
