// Every limb is a mass on a spring. One registry, stepped once a frame — which
// is what makes the whole rig feel alive rather than tweened.

export const springs = {};

/** Declare a spring: name, resting value, stiffness, damping. */
export const S = (name, value, k, d) => (springs[name] = { v: value, vel: 0, target: value, k, d });

export const set = (name, target) => (springs[name].target = target);
export const v = (name) => springs[name].v;

/** A shove, for the beats a target cannot express: a hop, a flinch, a startle. */
export const kick = (name, impulse) => (springs[name].vel += impulse);

/** Step one spring. Exported because the mood spring is deliberately advanced
 *  early — and therefore twice a frame — so the whole frame can read a mood that
 *  is already up to date. Its stiffness is tuned around that. */
export const stepSpring = (s, dt) => {
  s.vel += (s.k * (s.target - s.v) - s.d * s.vel) * dt;
  s.v += s.vel * dt;
};

export const stepSprings = (dt) => {
  for (const name in springs) stepSpring(springs[name], dt);
};
