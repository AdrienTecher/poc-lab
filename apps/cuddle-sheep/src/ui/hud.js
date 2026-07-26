// The two clocks, drawn as rings: the fleece on the left, the five minutes on
// the right. Both are read-outs of stored epochs, never counters — which is why
// they are right after a reload and right after a week away.
import { $ } from "../engine/svg.js";
import { clamp } from "../engine/math.js";
import { sfx } from "../engine/audio.js";
import * as save from "../engine/save.js";
import { state } from "../state.js";
import { HAPPY_MS, WOOL_READY } from "../rules.js";
import { remaining } from "../world/mood.js";

const ring = $("#ring"), chipState = $("#chipState"), chipTime = $("#chipTime");
const woolChip = $("#woolChip"), woolRing = $("#woolRing"), woolState = $("#woolState"), woolPct = $("#woolPct");
const soundBtn = $("#sound"), crossUI = $("#crossUI");

const RING_LEN = 2 * Math.PI * 13.6;

/** The control bar's height, published to CSS so the scene can keep clear of
 *  it — measured rather than assumed, because its content wraps. */
export const measureUI = () => {
  const top = crossUI.getBoundingClientRect().top;
  if (top) document.documentElement.style.setProperty("--ui-h", `${Math.round(innerHeight - top)}px`);
};

const paintSound = () => {
  soundBtn.setAttribute("aria-pressed", String(state.sound));
  soundBtn.setAttribute("aria-label", state.sound ? "Couper le son — mute" : "Activer le son — unmute");
};

export const build = () => {
  for (const r of [ring, woolRing]) {
    r.setAttribute("stroke-dasharray", RING_LEN.toFixed(2));
    r.setAttribute("stroke-dashoffset", RING_LEN.toFixed(2));
  }
  paintSound();   // he may have been muted last visit; the control has to say so
  soundBtn.addEventListener("click", () => {
    state.sound = !state.sound;
    paintSound();
    save.data.prefs.sound = state.sound;
    save.touch();
    if (state.sound) sfx.flutter();
  });
  measureUI();
  addEventListener("resize", measureUI);
};

export const paint = (w) => {
  woolRing.setAttribute("stroke-dashoffset", (RING_LEN * (1 - w)).toFixed(2));
  const ready = w >= WOOL_READY;
  const woolLabel = state.shearing ? "Tonte…" : ready ? "À tondre" : "Laine";
  if (woolState.textContent !== woolLabel) woolState.textContent = woolLabel;
  const pct = `${Math.round(w * 100)} %`;
  if (woolPct.textContent !== pct) woolPct.textContent = pct;
  woolChip.classList.toggle("ready", ready && !state.shearing);

  const left = remaining();
  const ratio = left > 0 ? clamp(left / HAPPY_MS, 0, 1) : state.cuddle;
  ring.setAttribute("stroke-dashoffset", (RING_LEN * (1 - ratio)).toFixed(2));
  if (left > 0) {
    const s = Math.ceil(left / 1000);
    chipState.textContent = "Heureux";
    chipTime.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} restantes`;
  } else if (state.cuddle > 0.02) {
    chipState.textContent = "Câlin…";
    chipTime.textContent = `${Math.round(state.cuddle * 100)} %`;
  } else if (state.dozing) {
    chipState.textContent = "Il somnole";
    chipTime.textContent = "réveille-le";
  } else {
    chipState.textContent = "Il boude";
    chipTime.textContent = "—:—";
  }
};
