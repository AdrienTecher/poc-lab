// Le loup, le mouton et le chou — the rules, with no world attached.
//
// Everything here is a pure function of where the three pieces are, which is
// what makes the crossing testable without a browser and what a second puzzle
// will copy: the diorama is the place's business, the predicate is the puzzle's.
export const PIECES = ["loup", "mouton", "chou"];

// loup + chou is legal: wolves do not eat cabbage
export const PAIRS = [["loup", "mouton"], ["mouton", "chou"]];

/** The minimum number of crossings — worth saying out loud when it is matched. */
export const OPTIMAL = 7;

/** Who is about to eat whom on this bank, if anyone. Null is the whole of the
 *  win condition for a move: there is no loss here, only a rewind. */
export const unsafe = (where, bank) =>
  PAIRS.find(([a, b]) => where[a] === bank && where[b] === bank) || null;

export const solved = (where) => PIECES.every((id) => where[id] === "R");
