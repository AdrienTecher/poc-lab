// La clôture — seven lanterns along a fence, and touching one post wakes its
// neighbours too. The rules, with no world attached.
//
// The old arcade name for this is "lights out", and the old goal is to turn
// everything OFF. Reversed here, deliberately: only one clock in this valley may
// empty and it is happiness, so what the fence asks is that every lantern be LIT.
// The board fills, the tally of touches fills, and nothing anywhere counts down.
export const POSTS = 7;

/** Touching a post flips its own lantern and the one either side of it. */
export const toggle = (lit, at) => lit.map((on, i) => (Math.abs(i - at) <= 1 ? !on : on));

export const solved = (lit) => lit.every(Boolean);

/**
 * Which posts still have to be touched, as a 0/1 per post — or null if the board
 * cannot be finished at all.
 *
 * This is a system over GF(2): lantern i is flipped by posts i-1, i and i+1, so
 * fixing the first post forces every one after it, and the last equation either
 * agrees or it does not. Two guesses at the first post is the whole search.
 *
 * The reason SEVEN posts matters: the kernel of that system is non-trivial only
 * when the count is 2 mod 3, so at seven the answer is UNIQUE. That is what lets
 * a minimum be stated at all — with a spare kernel vector there would be two
 * different shortest answers and "the fewest touches" would be a lie.
 */
export const remaining = (lit) => {
  const need = lit.map((on) => (on ? 0 : 1));
  for (const first of [0, 1]) {
    const x = new Array(POSTS).fill(0);
    x[0] = first;
    for (const i of [...Array(POSTS - 1).keys()]) {
      x[i + 1] = need[i] ^ (i >= 1 ? x[i - 1] : 0) ^ x[i];
    }
    if ((x[POSTS - 2] ^ x[POSTS - 1]) === need[POSTS - 1]) return x;
  }
  return null;
};

/** The fewest touches that can finish from here. */
export const fewest = (lit) => {
  const x = remaining(lit);
  return x ? x.reduce((n, v) => n + v, 0) : null;
};

/**
 * A board to start from, built by UNLIGHTING a solved fence rather than by
 * scattering lanterns and hoping. Scattering can produce a fence that cannot be
 * finished, and a comfort toy must never hand you one of those. Because the
 * answer at seven posts is unique, the set of posts pressed to make the board is
 * necessarily the set that undoes it — so the minimum comes free with the deal.
 *
 * `pick` is a stream of numbers in 0..1 from the caller, so this stays pure.
 */
export const start = (pick, wanted = 5) => {
  let lit = new Array(POSTS).fill(true);
  const chosen = new Set();
  let guard = 0;
  while (chosen.size < wanted && guard++ < 60) {
    const at = Math.min(POSTS - 1, Math.floor(pick() * POSTS));
    if (chosen.has(at)) continue;
    chosen.add(at);
    lit = toggle(lit, at);
  }
  // a fence that is already lit is not a puzzle; nudge one post and take the four
  if (solved(lit)) lit = toggle(lit, 3);
  return lit;
};
