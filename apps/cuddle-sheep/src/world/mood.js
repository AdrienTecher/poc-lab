// The five-minute window, and the one scalar the whole world is coloured by.
//
// `--m` is written here and nowhere else. Two things feed it: the cuddle you
// are giving him right now, and what is left of the window a finished cuddle
// bought. The window is wall-clock and stored, so it runs while the tab is
// closed and can never be rewound by anything outside this module.
import * as save from "../engine/save.js";
import { say } from "../ui/copy.js";
import { clamp, rand } from "../engine/math.js";
import { springs, S, set, kick, stepSpring } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { heart } from "../engine/particles.js";
import { state } from "../state.js";
import { HAPPY_MS, FADE_MS } from "../rules.js";
import { announce, hideHint, showHint } from "../ui/hint.js";
import { active } from "../places/registry.js";

// declared here, from the hydrated state: a sheep who was left happy is still
// happy when you come back, and must not spring up to it from zero
S("moodS", state.mood, 26, 10);

/** What is left of the window.
 *
 *  Clamped, because nothing in this game can buy more than HAPPY_MS: goHappy sets
 *  exactly that and topUp caps at it. So a larger number never means a longer
 *  cuddle — it means the machine's clock moved backwards underneath a stored
 *  epoch, which a timezone change or an NTP correction is enough to do. Left
 *  unclamped it reaches the HUD as "50849:39 restantes", which is the toy telling
 *  an obvious lie about something the whole game is built on.
 *
 *  Pure on purpose: this is read every frame, so it reports the truth and leaves
 *  repairing the stored value to the one place that hydrates it. */
export const remaining = () => Math.min(state.happyUntil - Date.now(), HAPPY_MS);

/** A cuddle just landed. `isRefresh` is a cuddle on top of a running window —
 *  worth a heart, not the whole fanfare. */
export const goHappy = (isRefresh) => {
  const wasHappy = state.happyUntil > Date.now();
  state.happyUntil = Date.now() + HAPPY_MS;
  save.data.sheep.happyUntil = state.happyUntil;
  save.touch(true);
  if (!wasHappy) {
    sfx.chime(); sfx.bleat(true);
    kick("hop", -330);
    for (const i of [...Array(14).keys()]) setTimeout(() => heart(rand(150, 250), rand(150, 235)), i * 55);
    announce(say.him.happy);
  } else if (isRefresh) {
    heart(rand(172, 228), 172);
    announce(say.him.happyAgain);
  }
  if (!state.everCuddled) { state.everCuddled = true; }
  hideHint();
};

/** A treat cannot make him happy — only a cuddle does — but it lengthens a
 *  window that is already running, capped at a full five minutes. Answers
 *  whether there was anything to lengthen. */
export const topUp = (ms) => {
  if (state.happyUntil <= Date.now()) return false;
  state.happyUntil = Math.min(state.happyUntil + ms, Date.now() + HAPPY_MS);
  save.data.sheep.happyUntil = state.happyUntil;
  return true;
};

let lastWrite = -1;
const writeMood = (m) => {
  if (Math.abs(m - lastWrite) < 0.004) return;
  lastWrite = m;
  document.documentElement.style.setProperty("--m", m.toFixed(3));
};

/** The mood spring is advanced here, early, and therefore twice a frame: once
 *  now so the rest of the frame reads a mood that is already up to date, and
 *  once more with every other spring. Its stiffness is tuned around that. */
export const step = (dt) => {
  const left = remaining();
  const timerMood = left <= 0 ? 0 : clamp(left / FADE_MS, 0, 1);
  if (state.byKey === "pet") {
    state.cuddle = clamp(state.cuddle + dt * 0.62, 0, 1);
    if (state.cuddle >= 1) goHappy(left > 0);
  } else if (!state.petting) {
    state.cuddle = Math.max(0, state.cuddle - dt * (timerMood > 0 ? 0.25 : 0.5));
  }
  set("moodS", clamp(Math.max(state.cuddle * 0.96, timerMood), 0, 1));
  stepSpring(springs.moodS, dt);
  const m = state.mood = clamp(springs.moodS.v, 0, 1);
  writeMood(m);
  return m;
};

/** When the five minutes run out, he says so. A second is fine here: this is a
 *  transition, not a countdown — the HUD does the counting. */
export const watch = () => {
  let wasHappy = state.happyUntil > Date.now();
  setInterval(() => {
    const isHappy = state.happyUntil > Date.now();
    if (wasHappy && !isHappy) {
      sfx.bleat(false);
      announce(say.him.windowClosed);
      if (!active()) showHint(...say.him.again);
      save.data.sheep.happyUntil = 0;
      save.touch(true);
    }
    wasHappy = isHappy;
  }, 1000);
};
