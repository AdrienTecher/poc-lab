// The two voices of the world: a bubble for eyes, a live region for screen
// readers. Both say the same thing, French first and English second — the
// outward-facing language rule applied to a toy that is played, not read.
import { $ } from "../engine/svg.js";

const hintEl = $("#hint"), hintText = $("#hintText"), live = $("#live");
let timer = 0;

const write = (fr, en) => {
  hintText.innerHTML = `${fr} <span class="en">· ${en}</span>`;
  hintEl.classList.remove("gone");
};

/** Say something and take it back after a few seconds — the default, because a
 *  hint that stays becomes furniture. */
export const setHint = (fr, en) => {
  write(fr, en);
  clearTimeout(timer);
  timer = setTimeout(() => hintEl.classList.add("gone"), 6500);
};

/** Say something and leave it up: used for the question he asks when his five
 *  minutes run out, which should wait for an answer. */
export const showHint = write;

export const hideHint = () => hintEl.classList.add("gone");

export const announce = (msg) => { live.textContent = msg; };
