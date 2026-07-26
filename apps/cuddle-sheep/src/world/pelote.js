// La pelote — a ball wound from his own fleece.
//
// It appears after the first shearing, because that is what it is made of. The
// fleece already becomes two things when it comes off: a cloud in the sky, and
// the bales in the barn. This is the third, and it needs no explaining — you
// sheared him, and now there is a ball of wool in the grass.
//
// It runs on NO clock. It has no threshold, no counter, no readout and nothing
// to be late for, and that is deliberate: this phase added a clock to the sky
// already, and a second one here would have made the meadow a list of chores.
//
// It also fills the only real gap in the verb list. Cuddling, feeding and
// shearing are all things you do TO him. Rolling the pelote is the one where he
// acts and you watch — which, for a toy about keeping something company, is
// worth more than another ritual.
import { el, tapTarget } from "../engine/svg.js";
import { clamp, rand, now } from "../engine/math.js";
import { kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { sparkle } from "../engine/particles.js";
import { state } from "../state.js";
import { meadow, placeAt } from "./scenery.js";
import { poke } from "./pointer.js";
import * as valley from "./valley.js";

const HOME = 470;            // between the clover at 355 and the one at 560
const GROUND = 214;
const LEFT = 40, RIGHT = 1160;
const DRAG = 1.35;           // how quickly grass takes the roll out of it
const HIS_X = 600;           // he stands in the middle of the meadow
const REACH = 96;            // how close it has to come before he notices

const ball = el("g", { class: "pelote", tabindex: "0", role: "button" });
let x = HOME, vx = 0, spin = 0, nudged = 0;

/** Where it is, for anything that wants to watch it — his eyes, mostly. */
export const rolling = () => (Math.abs(vx) > 12 ? { x, y: GROUND } : null);

const shove = (speed) => {
  vx = clamp(speed, -760, 760);
  poke();
  sfx.flutter();
};

export const build = () => {
  ball.setAttribute("aria-label", "Faire rouler la pelote — roll the ball of wool");
  tapTarget(ball, 54, 54, -34);
  // wound wool: a body, a soft rim, and three turns of yarn across it
  ball.appendChild(el("circle", { class: "pelote__rim", cx: 0, cy: -14, r: 15.5 }));
  ball.appendChild(el("circle", { class: "pelote__core", cx: 0, cy: -14, r: 13 }));
  for (const [d, o] of [["M-11,-20 A13,13 0 0,1 9,-25", 0.9], ["M-12,-12 A15,15 0 0,0 11,-8", 0.75],
    ["M-4,-27 A13,13 0 0,1 6,-2", 0.6]]) {
    ball.appendChild(el("path", { class: "pelote__yarn", d, opacity: o }));
  }
  // the loose end, which is what makes it read as wound rather than as a stone
  ball.appendChild(el("path", { class: "pelote__yarn", d: "M12,-9 q9,5 5,12", opacity: 0.85 }));
  meadow.appendChild(ball);

  ball.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    // it rolls away from the side you pushed, like a real ball would
    const box = ball.getBoundingClientRect();
    shove(e.clientX < box.x + box.width / 2 ? rand(340, 520) : -rand(340, 520));
  });
  ball.addEventListener("keydown", (e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    shove(x > HIS_X ? -rand(340, 520) : rand(340, 520));   // always toward him
  });

  valley.watch(sync);
  sync();
};

const sync = () => {
  const here = valley.shorn() > 0;
  ball.style.display = here ? "" : "none";
  ball.setAttribute("tabindex", here ? "0" : "-1");
  ball.style.pointerEvents = here ? "auto" : "none";
};

export const step = (dt) => {
  if (valley.shorn() === 0) return;

  if (vx !== 0) {
    x += vx * dt;
    spin += vx * dt * 2.4;
    vx -= vx * Math.min(1, DRAG * dt);
    if (Math.abs(vx) < 8) vx = 0;
    // the hedges at either end send it back rather than losing it
    if (x < LEFT) { x = LEFT; vx = Math.abs(vx) * 0.55; }
    if (x > RIGHT) { x = RIGHT; vx = -Math.abs(vx) * 0.55; }

    // He noses it back. This is the whole point of the object: the one moment
    // in the game where he does something and you are the one watching.
    if (Math.abs(x - HIS_X) < REACH && now() - nudged > 0.7) {
      nudged = now();
      vx = (x < HIS_X ? -1 : 1) * Math.max(240, Math.abs(vx) * 0.85);
      kick("hop", -150);
      kick("earL", -180); kick("earR", 180);
      sfx.bleat(state.mood > 0.5);
      for (const i of [...Array(3).keys()]) setTimeout(() => sparkle(rand(170, 230), rand(240, 280)), i * 80);
      poke();
    }
  }

  placeAt(ball, x, GROUND, 1.3);
  ball.style.setProperty("--spin", `${spin.toFixed(1)}deg`);
};
