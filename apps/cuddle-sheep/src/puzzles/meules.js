// Les meules — three hay bales, three posts, and the oldest puzzle there is,
// with no world attached.
//
// A bale is its size: 0 is the small one, 2 the big one. A post is a stack with
// the bottom of the pile first, so the last element is the one on top and the
// only one he can reach.
export const POSTS = 3;
export const BALES = 3;

/** The fewest moves that can ever solve it: 2^n - 1. Worth saying out loud when
 *  it is matched, and never a target the player is held to. */
export const OPTIMAL = 2 ** BALES - 1;

export const start = () => [[...Array(BALES).keys()].reverse(), [], []];

export const top = (stacks, post) => {
  const stack = stacks[post];
  return stack.length ? stack[stack.length - 1] : null;
};

/** Why a bale may not go here, or null if it may. A refusal is a sentence, not
 *  a failure: there is nothing to lose in this barn, only a bale to put back. */
export const refuses = (stacks, post, bale) => {
  const sitting = top(stacks, post);
  if (sitting === null) return null;
  if (sitting > bale) return null;
  return "bigger";   // a big bale would flatten a small one
};

export const solved = (stacks) => stacks[POSTS - 1].length === BALES;
