// Nuage — the composition root.
//
// Nothing is decided here. This file builds the world in the one order that
// matters, then runs the single frame loop that steps it. Everything a reader
// might want to change lives in a module named after the thing it changes:
// rules.js for the numbers, world/ for what he is, places/ for where he goes.
import { $ } from "./engine/svg.js";
import { attachParticles, stepParticles } from "./engine/particles.js";
import * as hud from "./ui/hud.js";
import * as scenery from "./world/scenery.js";
import * as sheep from "./world/sheep.js";
import * as clovers from "./world/clovers.js";
import * as wool from "./world/wool.js";
import * as sprout from "./world/sprout.js";
import * as butterflies from "./world/butterflies.js";
import * as hands from "./world/hands.js";
import * as mood from "./world/mood.js";
import * as riviere from "./places/riviere.js";
import * as camera from "./engine/camera.js";
import { refreshCTM } from "./world/pointer.js";
import { active } from "./places/registry.js";

attachParticles($("#fx"));

// The meadow is an SVG: it paints in DOM order, so the clovers go in the ground
// before the shears, and the shears before the four-leaf sprout.
scenery.build();
sheep.build();
clovers.build();
wool.build();
sprout.build();
butterflies.build();
hud.build();
hands.build();
riviere.build();    // after hands: Escape drops the shears before it leaves a place
clovers.settle();   // past solves may have earned more than the three he starts with
mood.watch();

let t = 0, last = performance.now();

const frame = (ms) => {
  const place = active();
  if (place) refreshCTM();
  // a tab left in the background hands back one enormous dt; clamping it keeps
  // every spring stable and every clock honest, since the clocks are epochs
  const dt = Math.min(0.034, (ms - last) / 1000);
  last = ms; t += dt;

  const m = mood.step(dt);
  const w = wool.step(dt);
  sheep.step(dt, t, m);          // steps every spring, the camera's included
  camera.paint();                // ...so the layers are framed before he is placed in them
  butterflies.step(dt, t, m);
  if (place) place.frame(dt, t);
  stepParticles(dt);
  scenery.setBloom(m > 0.5);
  hud.paint(w);

  requestAnimationFrame(frame);
};

requestAnimationFrame(frame);
