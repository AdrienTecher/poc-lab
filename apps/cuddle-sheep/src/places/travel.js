// Walking from one place to the next.
//
// The whole point is that HE is the one moving. The obvious build — spring the
// camera at the destination and spring him alongside it — makes him a passenger:
// two clocks running the same distance keep him pinned near the middle of the
// frame and only his legs move. So the camera is not driven at all. It is
// derived from where he is, with a dead band either side of centre:
//
//   he walks freely within ±BAND of the centre of the shot; past that he pushes
//   the camera along, and the push is clamped to the two frames' home positions
//   so you never see off the end of the road.
//
// The result is that he crosses ground at both ends of the journey and the world
// slides in the middle, which is what walking somewhere looks like. It is also
// desync-proof by construction: his position and the camera's are read from the
// same spring in the same frame, so there is no pair of clocks to drift apart.
import { clamp, lerp, now, REDUCED } from "../engine/math.js";
import { springs, S, set, v, kick } from "../engine/spring.js";
import { sfx } from "../engine/audio.js";
import { PITCH, VB_W, home, at as camAt } from "../engine/camera.js";
import { host } from "../world/host.js";
import { announce } from "../ui/hint.js";
import { release } from "../world/hands.js";
import { dropShears } from "../world/wool.js";
import { cancelDrag } from "../world/clovers.js";
import { poke, refreshCTM } from "../world/pointer.js";
import * as valley from "../world/valley.js";
import { mount, depart, active, placeOf } from "./registry.js";

const BAND = 150;        // user units either side of centre he may roam before the camera moves
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
  mount(place);
  valley.arrive(place.id);
  left.sleep();                    // only now: it was on screen the whole way
  place.land();
  refreshCTM();
};

export const step = (dt, t) => {
  if (!trip) return;
  const [ux, uy] = spot();
  host(ux, uy);

  // the camera follows him rather than leading him: a dead band at the centre of
  // the shot that he pushes when he leaves it, clamped to the road's two ends
  const centre = camAt() + VB_W / 2;
  const drift = ux - centre;
  if (Math.abs(drift) > BAND) {
    const push = camAt() + drift - Math.sign(drift) * BAND;
    set("camX", clamp(push, home(0), home(trip.place.road)));
  }

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
