// The live state of the sheep and the session. One mutable object, imported by
// everything that needs it — which is honest about what it is, rather than
// threading a context through every call.
//
// What is NOT here: anything persisted. The save file owns that
// (engine/save.js), and this is rehydrated from it at boot.
import { now } from "./engine/math.js";
import { FIRST_FLEECE, WOOL_FULL_MS } from "./rules.js";

export const state = {
  happyUntil: 0,        // epoch ms — the only source of the five-minute window
  cuddle: 0,            // 0..1, fills while stroking, decays when you stop
  mood: 0,              // smoothed 0..1, what the whole scene keys on
  petting: false,
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
};
