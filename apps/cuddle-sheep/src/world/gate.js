// The barn gate: the door to la grange, and the sprout's sibling.
//
// The four-leaf clover is grown by feeding him; this is earned by shearing him.
// Two care rituals, two doors — which is the whole shape of the game stated in
// the meadow, without a word of explanation.
import { el } from "../engine/svg.js";
import { clamp, now } from "../engine/math.js";
import { kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { state } from "../state.js";
import { FLEECES_TO_UNLOCK } from "../rules.js";
import { announce, setHint } from "../ui/hint.js";
import { meadow, placeProp } from "./scenery.js";
import * as valley from "./valley.js";
import { enter } from "../places/grange.js";

const gate = el("g", { class: "gate", role: "button", tabindex: "-1" });
let planks, revealing = false;

const paint = () => {
  const notch = valley.opened("grange") ? FLEECES_TO_UNLOCK : clamp(valley.shorn(), 0, FLEECES_TO_UNLOCK);
  gate.style.display = notch === 0 ? "none" : "";
  // a plank of the gate per fleece: the path is visibly built, not announced
  for (const [i, plank] of planks.entries()) plank.style.opacity = i < notch ? "1" : "0";
  const open = notch >= FLEECES_TO_UNLOCK;
  gate.classList.toggle("open", open);
  gate.setAttribute("tabindex", open ? "0" : "-1");
  gate.style.pointerEvents = open ? "auto" : "none";
};

const reveal = () => {
  if (!valley.open("grange")) return;
  revealing = false;
  gate.classList.add("reveal");
  setTimeout(() => sfx.chime(), 350);
  setTimeout(() => { state.lookAt = now() + 1.4; kick("earL", -220); kick("earR", 220); }, 500);
  setTimeout(() => setHint("La grange est ouverte — trois toisons y sont rangées",
    "the barn is open — three fleeces are stored there"), 900);
  announce("La grange s'ouvre au fond du pré : trois toisons y attendent d'être empilées.");
};

const sync = () => {
  paint();
  if (revealing || valley.opened("grange") || valley.shorn() < FLEECES_TO_UNLOCK) return;
  revealing = true;
  setTimeout(reveal, 700);
};

export const build = () => {
  gate.setAttribute("aria-label", "Aller à la grange — go to the barn");
  gate.innerHTML = `
    <circle class="gate__halo" cx="0" cy="-16" r="0" fill="#fff8d8"/>
    <rect x="-30" y="-46" width="60" height="62" fill="transparent"/>
    <path class="gate__post" d="M-22,14 L-22,-34 M22,14 L22,-34" stroke="var(--iso-wood-r)"
          stroke-width="6" stroke-linecap="round" fill="none"/>
    <g class="gate__planks">
      <rect class="gate__plank" x="-24" y="-16" width="48" height="9" rx="2.5" fill="var(--iso-wood)"/>
      <rect class="gate__plank" x="-24" y="-28" width="48" height="9" rx="2.5" fill="var(--iso-wood)"/>
      <rect class="gate__plank" x="-24" y="-40" width="48" height="9" rx="2.5" fill="var(--iso-wood)"/>
    </g>`;
  meadow.appendChild(gate);
  placeProp(gate, 660, 214, 1.5);
  planks = [...gate.querySelectorAll(".gate__plank")];

  gate.addEventListener("pointerdown", (e) => { e.stopPropagation(); enter(); });
  gate.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); enter(); }
  });

  valley.watch(sync);
  sync();
};
