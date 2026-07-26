// Le pont — one lantern, two planks' width, and four who have to be on the far
// side. The rules, with no world attached.
//
// The oldest telling of this puzzle counts a torch DOWN: it burns for so many
// minutes and you lose when it gutters. That is exactly the shape this valley
// refuses. Only one clock may ever empty here and it is happiness, because an
// emptying clock is the only kind that can make you late, and lateness is what a
// chore list is made of. So the lantern never goes out, and the minutes only
// ever add up — the question is not "did you make it in time" but "how few
// minutes was that", which is the same question la grange asks about moves.
//
// The consequence is that this board has no failure state at all. Nothing here
// returns a loss; the only refusals are parties the bridge cannot take.
export const WALKERS = ["nuage", "vif", "reveur", "ainee"];

/** Minutes each takes to walk the span, worn on an ear tag so the board can be
 *  read without a legend. A pair crosses at the slower one's pace — which is the
 *  whole puzzle, and the reason the eldest must never be paired with the sixth
 *  fastest thing you can think of. */
export const PACE = { nuage: 1, vif: 2, reveur: 5, ainee: 10 };

export const SEATS = 2;    // the planks take two abreast, and no more

/** 17 minutes: the two quick ones over (2), the quickest back (1), the two slow
 *  ones over together (10), the second-quickest back (2), the two quick ones
 *  over again (2). The trick is that the slow pair walk together ONCE, so the
 *  eldest's ten minutes are only ever spent the one time.
 *
 *  Worth saying out loud when it is matched, and never a target anyone is held
 *  to — every legal sequence finishes, this one merely finishes soonest. */
export const OPTIMAL = 17;

export const start = () => Object.fromEntries(WALKERS.map((w) => [w, "L"]));

/** What a crossing costs: the slower of the two who are walking it. */
export const cost = (party) => Math.max(...party.map((w) => PACE[w]));

/** Why this party may not set off, or null if it may. A refusal is a sentence,
 *  never a loss: there is nothing to lose on this bridge, only a lamb to leave
 *  behind or bring along. */
export const refuses = (where, party, lantern) => {
  if (!party.length) return "empty";              // the lantern does not walk itself
  if (party.length > SEATS) return "crowded";
  if (party.some((w) => where[w] !== lantern)) return "apart";
  return null;
};

/** The lantern is always where the last party arrived, so the side it is on is
 *  the only side anyone can set off from. Deriving it rather than storing it is
 *  what makes an illegal board unrepresentable. */
export const solved = (where) => WALKERS.every((w) => where[w] === "R");
