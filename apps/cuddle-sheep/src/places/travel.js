// Walking from one place to the next.
//
// The whole point is that HE is the one moving. Spring the camera at the
// destination and spring him alongside it and he becomes a passenger: two clocks
// covering the same distance pin him near the middle of the frame with only his
// legs moving.
//
// So both come off ONE clock — the trip spring — and differ only in their curve.
// He crosses the ground linearly; the camera follows an S, lagging him early and
// overtaking him late. The gap between them, which is exactly where he sits on
// screen, therefore opens as he sets off and closes as he arrives: he walks out
// ahead, the world catches up, and they land together.
//
// A dead band round the centre of the shot was the first build and it is wrong
// here for a reason worth recording: the camera can then only travel as far as
// he does, and two doorways are much closer together than the frames they stand
// in are wide. It left the destination 470 units off-centre on arrival. Deriving
// the camera from trip PROGRESS rather than from his POSITION makes the arrival
// framing exact by construction — g(1) = 1 — whatever the doors' spacing.
import { clamp, lerp, now, REDUCED } from "../engine/math.js";
import { say } from "../ui/copy.js";
import { springs, S, set, v, kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { PITCH, home, panTo } from "../engine/camera.js";
import { host } from "../world/host.js";
import { announce } from "../ui/hint.js";
import { release } from "../world/hands.js";
import { dropShears } from "../world/wool.js";
import { cancelDrag } from "../world/clovers.js";
import { poke, refreshCTM } from "../world/pointer.js";
import * as valley from "../world/valley.js";
import { mount, depart, active, placeOf, roster } from "./registry.js";

const STRIDE = 74;       // user units per hoofbeat
const TRIP_MS = 3400;    // the deadline floor: a backgrounded tab may never strand him

// Softer than it was, because the path is three legs now rather than one: the same
// spring over three times the distance made him sprint. ζ = 7.6/(2√15) = 0.98, just
// under critical, so he arrives without overshooting and without a bounce.
S("trip", 1, 15, 7.6);   // 0 where he was standing, 1 where he will be standing

let trip = null;

export const going = () => trip !== null;

/** A place's doorway in SHARED user units, on the side he is actually using.
 *
 *  There used to be one doorway per place, which meant leaving east and leaving
 *  west both began at the same spot. Now that the way out IS the border of the
 *  frame, he leaves by the edge he is heading for and arrives at the opposite edge
 *  of the next place — so a walk east goes out of the right of one screen and in at
 *  the left of the next, which is the whole reading of the thing. */
const doorOf = (place, dir) => shift(place, place.doorway(dir));

/** A point authored in one place's own tile space, moved to its stretch of the road. */
const shift = (place, [ux, uy]) => [ux + place.road * PITCH, uy];

/** Where he is right now, along the whole walk.
 *
 *  A THREE-legged path, and that is the fix for the thing that looked wrong: he used
 *  to be dropped onto the departure threshold the instant a trip began and lifted off
 *  the arrival one the instant it ended — measured at 258px and 159px of teleport,
 *  with the crossing in between rendered perfectly. So the walk now starts where he
 *  is actually standing, goes to the threshold, crosses, and finishes by walking to
 *  where he will stand. Nothing about him jumps any more.
 *
 *  Parameterised by ARC LENGTH rather than by leg, so his pace is even throughout
 *  instead of hurrying through whichever leg happens to be short. */
const spot = () => {
  const f = clamp(v("trip"), 0, 1);
  const want = f * trip.total;
  let run = 0;
  for (let i = 1; i < trip.path.length; i++) {
    const seg = trip.legs[i - 1];
    if (want <= run + seg || i === trip.path.length - 1) {
      const t = seg > 0 ? clamp((want - run) / seg, 0, 1) : 1;
      const a = trip.path[i - 1], b = trip.path[i];
      return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    }
    run += seg;
  }
  return trip.path.at(-1);
};

/** How far through the CROSSING he is, 0 before it and 1 after.
 *
 *  The camera keys on this rather than on the whole walk, so it holds still while he
 *  crosses his own frame to the threshold, pans while he is between the two, and
 *  holds again while he walks in on the other side. Which is also what a screen does
 *  in Dofus: it changes while you are at the border, not while you are wandering
 *  toward it. */
const crossing = () => {
  const f = clamp(v("trip"), 0, 1);
  const [a, b] = trip.gate;
  return b > a ? clamp((f - a) / (b - a), 0, 1) : 1;
};

/** The nearest open place in a direction: +1 east, -1 west. What a swipe and an
 *  arrow key mean, neither of which knows the name of anywhere. */
export const toward = (from, dir) => {
  const next = roster()
    .filter((p) => p !== from && valley.opened(p.id) && Math.sign(p.road - from.road) === dir)
    .sort((a, b) => Math.abs(a.road - from.road) - Math.abs(b.road - from.road))[0];
  if (next) go(next.id);
};

export const go = (id) => {
  const from = active();
  const to = placeOf(id);
  if (!from || !to || from === to || trip !== null) return;
  if (!valley.opened(to.id)) return;

  // put down everything before setting off — a clover in your hand and a pair of
  // shears out are both things that belong to the place you are leaving
  release();
  dropShears();
  cancelDrag();
  poke();

  from.leave();                    // nothing it has in flight may land behind him
  to.wake();                       // the destination is drawn before it is on screen
  // out of the border he is heading for, in at the opposite border of the next
  const dir = Math.sign(to.road - from.road) || 1;
  const a = doorOf(from, dir), b = doorOf(to, -dir);
  // Where he IS, and where he will STAND. A place knows both; standsAt is optional
  // and falls back to the threshold, which is what every place did implicitly before.
  const here = shift(from, from.standsAt?.() ?? from.doorway(dir));
  const there = shift(to, to.standsAt?.() ?? to.doorway(-dir));
  const path = [here, a, b, there];
  const legs = path.slice(1).map((q, i) => Math.hypot(q[0] - path[i][0], q[1] - path[i][1]));
  const total = legs.reduce((n, d) => n + d, 0) || 1;
  // where the crossing begins and ends as a fraction of the whole walk, for the camera
  const gate = [legs[0] / total, (legs[0] + legs[1]) / total];
  trip = {
    path, legs, total, gate, from: a, to: b,
    place: to, left: from, until: now() + TRIP_MS / 1000, beat: 0,
  };
  depart();
  springs.trip.v = 0; springs.trip.vel = 0;
  set("trip", 1);
  sfx.flutter();
  announce(say.road.setOff(to.label[0]));
  if (REDUCED) { springs.trip.v = 1; arrive(); }
};

const arrive = () => {
  const { place, left } = trip;
  trip = null;
  springs.trip.v = springs.trip.target = 1;
  mount(place, true);              // quiet: no curtain over a walk you are meant to watch
  panTo(place.road);               // g(1) is exactly 1, but say so rather than imply it
  valley.arrive(place.id);
  left.sleep();                    // only now: it was on screen the whole way
  place.land();
  refreshCTM();
};

export const step = (dt, t) => {
  if (!trip) return;
  const [ux, uy] = spot();
  host(ux, uy);

  // smootherstep over the CROSSING, so the camera is still while he walks his own
  // frame to the threshold, travels while he is between the two, and is still again
  // while he walks in on the far side
  const f = crossing();
  const g = f * f * f * (f * (f * 6 - 15) + 10);
  set("camX", lerp(home(trip.left.road), home(trip.place.road), g));

  // a hoofbeat every stride, so the gait comes from the distance covered and
  // not from a timer — he steps faster when he is moving faster
  if (!REDUCED) {
    trip.beat += Math.abs(springs.trip.vel) * dt * Math.hypot(trip.to[0] - trip.from[0], trip.to[1] - trip.from[1]);
    if (trip.beat > STRIDE) {
      trip.beat = 0;
      kick("hop", -120);
      kick("earL", -70); kick("earR", 70);
    }
  }

  // Arrive on the spring, or on the deadline, whichever comes first. The floor
  // matters: a tab left in the background hands back one enormous dt, and a
  // player must never come back to a sheep stranded between two places.
  const done = Math.abs(1 - v("trip")) < 0.012 && Math.abs(springs.trip.vel) < 0.05;
  if (done || now() > trip.until) arrive();
};

/** Both dioramas animate for the length of the journey — you are looking at
 *  them — but neither is mounted, so neither can move him or take a click. */
export const scenery = (dt, t) => {
  if (!trip) return;
  trip.left.frame(dt, t);
  trip.place.frame(dt, t);
};
