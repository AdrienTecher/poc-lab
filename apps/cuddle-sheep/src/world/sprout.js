// The four-leaf clover: the door to the river, and the only thing in the meadow
// that is a reward for care rather than an act of it.
//
// It grows a notch per clover eaten, so the way in is visible long before it
// opens — the care loop's progress bar, drawn as a plant.
import { el } from "../engine/svg.js";
import { clamp, now } from "../engine/math.js";
import { kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { state } from "../state.js";
import { CLOVERS_TO_UNLOCK } from "../rules.js";
import { announce, setHint } from "../ui/hint.js";
import { meadow, placeProp } from "./scenery.js";
import * as valley from "./valley.js";
import { enter } from "../places/riviere.js";

const NOTCH_DASH = [34, 25, 16, 8, 0], NOTCH_SCALE = [0, 0, 0.45, 0.72, 1];

const sprout = el("g", { class: "sprout", role: "button", tabindex: "-1" });
let stem, leaves, revealing = false;

const paint = () => {
  const notch = valley.opened("riviere") ? 4 : clamp(state.fed - 1, 0, 4);
  sprout.style.display = notch === 0 ? "none" : "";
  stem.style.strokeDashoffset = NOTCH_DASH[notch];
  leaves.style.transform = `scale(${NOTCH_SCALE[notch]})`;
  sprout.classList.toggle("open", notch === 4);
  sprout.setAttribute("tabindex", notch === 4 ? "0" : "-1");
  sprout.style.pointerEvents = notch === 4 ? "auto" : "none";
};

const reveal = () => {
  if (!valley.open("riviere")) return;   // open() is the only writer, and it only opens once
  revealing = false;
  sprout.classList.add("reveal");
  setTimeout(() => sfx.chime(), 350);
  // he notices it before you do
  setTimeout(() => { state.lookAt = now() + 1.4; kick("earL", -220); kick("earR", 220); }, 500);
  setTimeout(() => setHint("Un trèfle à quatre feuilles — touche-le", "a four-leaf clover — tap it"), 900);
  announce("Un trèfle à quatre feuilles a poussé dans le pré : touche-le pour la traversée.");
};

const sync = () => {
  paint();
  if (revealing || valley.opened("riviere") || state.fed < CLOVERS_TO_UNLOCK) return;
  revealing = true;
  setTimeout(reveal, 700);
};

export const build = () => {
  sprout.setAttribute("aria-label", "Jouer à la traversée — play the crossing");
  sprout.innerHTML = `
    <circle class="sprout__halo" cx="0" cy="-8" r="0" fill="#fff8d8"/>
    <path class="sprout__stem" d="M0,2 L0,36" stroke="#3f8a36" stroke-width="3" stroke-linecap="round"
          fill="none" stroke-dasharray="34" stroke-dashoffset="34"/>
    <rect x="-26" y="-30" width="52" height="72" fill="transparent"/>
    <g class="sprout__leaves">
      <use class="sprout__rim" href="#cloverLeaves" fill="var(--fourleaf-rim)" transform="scale(1.24)"/>
      <use href="#cloverLeaves" fill="#4ea343"/>
      <use href="#cloverLeaves" fill="#69c257" transform="scale(.82)"/>
    </g>`;
  meadow.appendChild(sprout);
  placeProp(sprout, 975, 208, 1.55);
  stem = sprout.querySelector(".sprout__stem");
  leaves = sprout.querySelector(".sprout__leaves");

  sprout.addEventListener("pointerdown", (e) => { e.stopPropagation(); enter(); });
  sprout.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); enter(); }
  });

  valley.watch(sync);
  sync();
};
