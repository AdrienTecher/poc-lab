// The live state of the sheep and the session. One mutable object, imported by
// everything that needs it — which is honest about what it is, rather than
// threading a context through every call.
//
// What is NOT here: anything persisted. The save file owns that
// (engine/save.js), and this is rehydrated from it at the foot of this module —
// before any other module's body runs, which is what lets them read a state
// that is already true.
import * as save from "./engine/save.js";
import { now } from "./engine/math.js";
import { FIRST_FLEECE, WOOL_FULL_MS, HAPPY_MS } from "./rules.js";

export const state = {
  happyUntil: 0,        // epoch ms — the only source of the five-minute window
  cuddle: 0,            // 0..1, fills while stroking, decays when you stop
  mood: 0,              // smoothed 0..1, what the whole scene keys on
  petting: false,
  byKey: null,          // null | "pet" | "shear" — a held key, not a held pointer
  dozing: false,
  chewUntil: 0,
  bleatUntil: 0,
  lastPoke: now(),
  lastPointer: -99,
  everCuddled: false,
  sound: true,
  // the fleece is stored as the instant it was last taken to zero, so it keeps
  // growing while the tab is closed — one timestamp, no ticking to persist
  woolFrom: Date.now() - FIRST_FLEECE * WOOL_FULL_MS,
  wool: FIRST_FLEECE,
  tool: null,           // null | "shears" — a held tool, not a mode toggle
  shearing: false,
  shiverUntil: 0,
  fed: 0,               // clovers eaten, all-time
  lookAt: 0,            // until when his gaze is forced at the meadow sprout
  dragging: null,       // the clover currently in your hand, if any
};

// Restore an in-flight happiness window so a reload doesn't betray him — but never
// further out than a window can legitimately be. An epoch beyond now + HAPPY_MS was
// never a value this game could produce; it means the clock moved backwards under a
// stored one. Healed here rather than merely hidden by the readout, or it would sit
// in the save telling the same lie until real time caught up with it.
if (save.data.sheep.happyUntil > Date.now()) {
  const ceiling = Date.now() + HAPPY_MS;
  state.happyUntil = Math.min(save.data.sheep.happyUntil, ceiling);
  if (save.data.sheep.happyUntil > ceiling) {
    save.data.sheep.happyUntil = state.happyUntil;
    save.touch(true);
  }
  state.mood = 1;
  state.everCuddled = true;
}
// A first visit starts mid-fleece — write that epoch down straight away, or a
// player who never shears would start over at 45% on every reload.
if (save.data.sheep.woolFrom > 0) state.woolFrom = save.data.sheep.woolFrom;
else { save.data.sheep.woolFrom = state.woolFrom; save.touch(true); }
state.fed = save.data.care.fed;
state.sound = save.data.prefs.sound;
