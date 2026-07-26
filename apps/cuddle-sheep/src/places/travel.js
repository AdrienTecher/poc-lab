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
const TRIP_MS = 2600;    // the deadline floor: a backgrounded tab may never strand him

S("trip", 1, 30, 11);    // 0 at the door he left, 1 at the door he is walking to

let trip = null;

export const going = () => trip !== null;

/** A place's doorway in SHARED user units. */
const doorOf = (place) => {
  const [ux, uy] = place.doorway();
  return [ux + place.road * PITCH, uy];
};

/** Where he is right now, between the two doors. */
const spot = () => {
  const f = clamp(v("trip"), 0, 1);
  return [lerp(trip.from[0], trip.to[0], f), lerp(trip.from[1], trip.to[1], f)];
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
  const a = doorOf(from), b = doorOf(to);
  trip = { from: a, to: b, place: to, left: from, until: now() + TRIP_MS / 1000, beat: 0 };
  depart();
  springs.trip.v = 0; springs.trip.vel = 0;
  set("trip", 1);
  sfx.flutter();
  announce(`Nuage part vers ${to.label[0]}.`);
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

  // smootherstep: flat at both ends, so the camera is still while he sets off
  // and still again while he arrives, and does its travelling in between
  const f = clamp(v("trip"), 0, 1);
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
