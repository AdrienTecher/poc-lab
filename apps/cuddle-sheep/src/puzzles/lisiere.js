// La lisière — three hens along a perch, one dog who can watch three boxes at a
// time, and dusk coming. The rules, with no world attached.
//
// This is deliberately NOT another river crossing. La traversée is already
// wolf-sheep-cabbage, and fox-goose-corn is that same puzzle wearing a different
// coat — so the fox here never takes anything and there is no illegal pair. What
// there is instead is a gathering problem: get all three hens inside the span the
// dog can watch, in as few moves as you can.
//
// It is a median problem in disguise, which is why a minimum can be stated: for
// each place the dog could lie, the cheapest arrangement pairs the sorted hens
// with the sorted boxes, and the answer is the best of those. No search, no AI,
// no losing move, and every board is solvable from the start.
export const BOXES = 8;
export const HENS = 3;

/** How many boxes in a row the dog can keep an eye on. Three hens and three
 *  watched boxes means the finish is exactly one hen per box — no spare room,
 *  which is what stops the answer being trivially "put them anywhere near him". */
export const SPAN = 3;

/** Where the dog's span may begin, so it never hangs off the end of the perch. */
export const SPOTS = BOXES - SPAN + 1;

export const sorted = (hens) => [...hens].sort((a, b) => a - b);

/** Every hen inside the dog's span. Because there are as many hens as watched
 *  boxes, this is the same as saying the sorted hens ARE the watched boxes. */
export const solved = (hens, dog) =>
  sorted(hens).every((h, i) => h === dog + i);

/** What it costs to finish from here, and it is exact rather than a guess. A hen
 *  flies to any empty box for one move per box travelled — she is a bird, and
 *  requiring a clear perch would turn a gathering problem into a sliding one. */
export const fewest = (hens, dog) => {
  const h = sorted(hens);
  let best = Infinity;
  for (const s of [...Array(SPOTS).keys()]) {
    const cost = Math.abs(s - dog) + h.reduce((sum, at, i) => sum + Math.abs(at - (s + i)), 0);
    if (cost < best) best = cost;
  }
  return best;
};

/** Why a hen may not go there, or null if she may. A refusal is a sentence: the
 *  box is taken, or it is the one she is already in. Nothing is ever lost. */
export const refuses = (hens, from, to) => {
  if (to < 0 || to >= BOXES) return "off";
  if (to === from) return "same";
  if (hens.includes(to)) return "taken";
  return null;
};

/** A board to start from: hens spread out and the dog off to one side, so there
 *  is always something to gather. Built by construction rather than by rejection
 *  — every arrangement of distinct boxes is solvable, so the only thing to avoid
 *  is handing out a board that is already finished. */
export const start = (pick) => {
  const boxes = [...Array(BOXES).keys()];
  const hens = [];
  while (hens.length < HENS) {
    const at = boxes[Math.min(boxes.length - 1, Math.floor(pick() * boxes.length))];
    boxes.splice(boxes.indexOf(at), 1);
    hens.push(at);
  }
  const dog = Math.min(SPOTS - 1, Math.floor(pick() * SPOTS));
  // an already-gathered flock is not a puzzle; shove the dog to the far end
  if (solved(hens, dog)) return { hens: sorted(hens), dog: dog === 0 ? SPOTS - 1 : 0 };
  return { hens: sorted(hens), dog };
};
