// Le chien — the second animal, and the only one that is also a game piece.
//
// He arrives in the meadow once the two of you have finished something together,
// which is the one thing in this world that is neither a chore nor a clock: he is
// not earned by feeding or shearing, he turns up because you did something.
//
// He runs on NO clock, exactly like la pelote. Petting him fills nothing, buys
// nothing and is late for nothing. That is deliberate and it is the invariant:
// happiness is the sheep's clock and the only one allowed to empty, so a second
// animal must not come with a second thing to keep topped up. He is company.
//
// His DRAWING lives here rather than in the place that uses him, because he is
// one animal. La lisière asks this module for him, so the dog on the board and the
// dog in the grass cannot drift apart into two dogs that merely look alike.
import { el, tapTarget } from "../engine/svg.js";
import { now } from "../engine/math.js";
import { kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { state } from "../state.js";
import { meadow, placeProp } from "./scenery.js";
import { poke } from "./pointer.js";
import * as valley from "./valley.js";

/**
 * The dog, as markup, at a given scale. Rounded like everything alive in this app
 * — the fence and the nest boxes are faceted, he is not.
 *
 * `lying` is the meadow pose: chin on paws, because a sheepdog at rest is the
 * shape of a dog who is off duty. On the board he stands, because he is working.
 */
export const dogArt = (k = 1, lying = false) => {
  const s = (n) => (n * k).toFixed(1);
  const legs = lying
    ? `<ellipse cx="${s(-6)}" cy="${s(-6)}" rx="${s(19)}" ry="${s(7)}" fill="var(--chien-coat-l)"/>`
    : `<line x1="${s(-14)}" y1="${s(-17)}" x2="${s(-15)}" y2="0" stroke="var(--chien-coat-l)" stroke-width="${s(6)}" stroke-linecap="round"/>
       <line x1="${s(12)}" y1="${s(-17)}" x2="${s(13)}" y2="0" stroke="var(--chien-coat-l)" stroke-width="${s(6)}" stroke-linecap="round"/>`;
  const bodyY = lying ? -13 : -24;
  return `
    <ellipse cx="0" cy="${s(2)}" rx="${s(31)}" ry="${s(8)}" fill="#1d2a22" opacity=".2"/>
    ${legs}
    <path class="chien__tail" d="M${s(-21)},${s(bodyY + 2)} q${s(-13)},${s(-6)} ${s(-11)},${s(-17)}"
          stroke="var(--chien-coat)" stroke-width="${s(6)}" fill="none" stroke-linecap="round"/>
    <ellipse cx="0" cy="${s(bodyY)}" rx="${s(24)}" ry="${s(15)}" fill="var(--chien-coat)"/>
    <ellipse cx="${s(-3)}" cy="${s(bodyY + 5)}" rx="${s(16)}" ry="${s(9)}" fill="var(--chien-bib)"/>
    <ellipse cx="${s(20)}" cy="${s(bodyY - 9)}" rx="${s(14)}" ry="${s(12)}" fill="var(--chien-coat)"/>
    <ellipse cx="${s(26)}" cy="${s(bodyY - 4)}" rx="${s(9)}" ry="${s(7)}" fill="var(--chien-bib)"/>
    <path d="M${s(13)},${s(bodyY - 18)} q${s(-4)},${s(-11)} ${s(4)},${s(-12)} q${s(3)},${s(7)} ${s(1)},${s(12)} Z"
          fill="var(--chien-coat-l)"/>
    <ellipse cx="${s(32)}" cy="${s(bodyY - 2)}" rx="${s(4)}" ry="${s(3)}" fill="#2f2733"/>
    <circle cx="${s(24)}" cy="${s(bodyY - 11)}" r="${s(2.6)}" fill="#2f2733"/>
    <circle cx="${s(25)}" cy="${s(bodyY - 12)}" r="${s(0.9)}" fill="#fff"/>`;
};

const dog = el("g", { class: "chien", tabindex: "0", role: "button" });
let wagUntil = 0;

export const build = () => {
  dog.setAttribute("aria-label", "Caresser le chien — pet the dog");
  tapTarget(dog, 74, 56, -44);
  dog.innerHTML += dogArt(1, true);
  meadow.appendChild(dog);
  placeProp(dog, 250, 212, 1.25);

  const pat = () => {
    poke();
    wagUntil = now() + 2.2;
    dog.classList.add("wagging");
    // He is glad, and that is the whole of it. No window opens, no clock is
    // topped up, nothing is written down — petting the dog is not a ritual.
    sfx.purr();
    // the sheep notices, which is the only way the two animals interact
    state.lookAt = now() + 1.1;
    kick("earL", -120); kick("earR", 120);
    setTimeout(() => { if (now() >= wagUntil) dog.classList.remove("wagging"); }, 2300);
  };
  dog.addEventListener("pointerdown", (e) => { e.stopPropagation(); pat(); });
  dog.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); pat(); }
  });

  valley.watch(sync);
  sync();
};

/** He turns up once anything at all has been finished together. */
const solvedAnything = () => Object.values(valley.seen()).length > 0
  && ["riviere", "grange", "pont", "clocher", "cloture", "lisiere"].some((p) => valley.solves(p) > 0);

const sync = () => {
  const here = solvedAnything();
  dog.style.display = here ? "" : "none";
  dog.setAttribute("tabindex", here ? "0" : "-1");
  dog.style.pointerEvents = here ? "auto" : "none";
};
