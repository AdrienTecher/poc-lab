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
import * as gate from "./world/gate.js";
import * as pelote from "./world/pelote.js";
import * as butterflies from "./world/butterflies.js";
import * as hands from "./world/hands.js";
import * as mood from "./world/mood.js";
import * as valley from "./world/valley.js";
import * as daylight from "./world/daylight.js";
import * as riviere from "./places/riviere.js";
import * as grange from "./places/grange.js";
import * as camera from "./engine/camera.js";
import { refreshCTM } from "./world/pointer.js";
import { active, placeOf } from "./places/registry.js";
import * as travel from "./places/travel.js";

attachParticles($("#fx"));

// The meadow is an SVG: it paints in DOM order, so the clovers go in the ground
// before the shears, and the shears before the four-leaf sprout.
scenery.build();
sheep.build();
clovers.build();
wool.build();
sprout.build();
gate.build();
pelote.build();
butterflies.build();
hud.build();
hands.build();
riviere.build();    // after hands: Escape drops the shears before it leaves a place
grange.build();
clovers.settle();   // past solves may have earned more than the three he starts with
mood.watch();

// He was left somewhere. Put him back there rather than marching him home —
// the valley is a place you return to, not a level you restart.
const wasAt = placeOf(valley.at());
if (wasAt) wasAt.enter();

let t = 0, last = performance.now();

const frame = (ms) => {
  const place = active();
  if (place || travel.going()) refreshCTM();
  // a tab left in the background hands back one enormous dt; clamping it keeps
  // every spring stable and every clock honest, since the clocks are epochs
  const dt = Math.min(0.034, (ms - last) / 1000);
  last = ms; t += dt;

  daylight.step();
  const m = mood.step(dt);
  const w = wool.step(dt);
  sheep.step(dt, t, m);          // steps every spring, the camera's included
  camera.paint();                // ...so the layers are framed before he is placed in them
  butterflies.step(dt, t, m);
  pelote.step(dt);
  if (place) place.frame(dt, t);
  else if (travel.going()) { travel.scenery(dt, t); travel.step(dt, t); }
  stepParticles(dt);
  scenery.setBloom(m > 0.5);
  hud.paint(w);

  requestAnimationFrame(frame);
};

requestAnimationFrame(frame);
