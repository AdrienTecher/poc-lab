// Your hands: every way a player touches this world.
//
// One module owns the listeners so that the rules of "what is being touched"
// live in one place — a stroke, a tap, a held key, a dragged clover and a pair
// of shears all start from the same pointer, and telling them apart is the
// whole job.
import { $ } from "../engine/svg.js";
import { clamp, rand, now } from "../engine/math.js";
import { kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { sparkle } from "../engine/particles.js";
import { state } from "../state.js";
import { PET_TARGET } from "../rules.js";
import { active } from "../places/registry.js";
import { ptr, toSvg, track, poke } from "./pointer.js";
import { onSheep, hit, bleat } from "./sheep.js";
import { goHappy } from "./mood.js";
import { takeShears, dropShears, shearStroke, grabTool, moveTool, shearsNode } from "./wool.js";
import { dragTo, drop, feedNearest } from "./clovers.js";

const svg = $("#sheep"), stage = $("#stage");

let petPrev = null, shearPrev = null;
let downAt = 0, downPos = null;

/** Let go of him — he is walking into a place, and nothing may follow him in. */
export const release = () => {
  state.petting = false;
  state.byKey = null;
  petPrev = null;
  stage.classList.remove("cuddling");
};

export const build = () => {
  svg.addEventListener("pointerdown", (e) => {
    const p = toSvg(e);
    if (state.tool) grabTool(e);
    if (!onSheep(p)) { if (state.tool) dropShears(); return; }
    svg.setPointerCapture?.(e.pointerId);
    poke();
    if (state.tool === "shears") {
      state.shearing = true;
      shearPrev = p;
      kick("earL", -90); kick("earR", 90);
      return;
    }
    state.petting = true;
    petPrev = p;
    stage.classList.add("cuddling");
    kick("earL", -140); kick("earR", 140);
  });

  addEventListener("pointermove", (e) => {
    const p = track(e);
    if (!state.dozing || onSheep(p)) poke();

    if (state.tool) moveTool(e.clientX, e.clientY);

    if (state.shearing && shearPrev) {
      const d = Math.hypot(p.x - shearPrev.x, p.y - shearPrev.y);
      shearPrev = p;
      if (d > 0.4) shearStroke(p, d);
    } else if (state.petting && petPrev) {
      const d = Math.hypot(p.x - petPrev.x, p.y - petPrev.y);
      petPrev = p;
      if (d > 0.4) {
        const before = state.cuddle;
        state.cuddle = clamp(state.cuddle + d / PET_TARGET, 0, 1);
        if (Math.random() < d / 90) sparkle(p.x + rand(-16, 16), p.y + rand(-16, 16));
        if (Math.random() < d / 700) sfx.purr();
        if (before < 1 && state.cuddle >= 1) goHappy(false);
        else if (state.cuddle >= 1 && Math.random() < d / 500) goHappy(true);
      }
    }
    dragTo(e.clientX, e.clientY);
  }, { passive: true });

  const endPointer = (e) => {
    if (state.petting) { state.petting = false; petPrev = null; stage.classList.remove("cuddling"); }
    if (state.shearing) { state.shearing = false; shearPrev = null; }
    drop(e);
  };
  addEventListener("pointerup", endPointer);
  addEventListener("pointercancel", endPointer);
  document.addEventListener("pointerleave", () => { ptr.inside = false; });

  // a tap that doesn't travel is a poke, not a cuddle: he just answers
  svg.addEventListener("pointerdown", (e) => { downAt = now(); downPos = toSvg(e); });
  svg.addEventListener("pointerup", (e) => {
    if (!downPos) return;
    const p = toSvg(e);
    if (now() - downAt < 0.35 && Math.hypot(p.x - downPos.x, p.y - downPos.y) < 12 && onSheep(p)) {
      const place = active();
      if (place) place.tapSheep(); else bleat();
    }
    downPos = null;
  });

  /* ---- keyboard: the sheep itself is focusable and holdable ---- */
  hit.setAttribute("tabindex", "0");
  hit.setAttribute("role", "button");
  hit.setAttribute("aria-label", "Caresser Nuage — maintiens Espace pour le câliner");
  hit.addEventListener("keydown", (e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    poke();
    const place = active();
    if (e.key === "Enter" && place) { place.tapSheep(); return; }
    if (state.tool === "shears") { state.byKey = "shear"; state.shearing = true; }
    else { state.byKey = "pet"; state.petting = true; }
  });
  const stopKeys = () => {
    state.byKey = null;
    state.petting = false;
    state.shearing = false;
  };
  hit.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") stopKeys(); });
  hit.addEventListener("blur", stopKeys);

  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "f" && !active()) feedNearest();
    if (e.key === "Escape") dropShears();
    if (k === "t" && !active()) (state.tool ? dropShears : takeShears)();
  });

  // clicking anywhere else in the world puts the shears back in the grass
  addEventListener("pointerdown", (e) => {
    if (!state.tool) return;
    if (svg.contains(e.target) || shearsNode.contains(e.target)) return;
    dropShears();
  });
};
