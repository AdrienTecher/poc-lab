// Le carillon — five bells and a phrase to give back. The rules, with no world
// attached and no sound attached either.
//
// The scale is pentatonic on purpose. Any two of these five ring together
// without a sour interval, so a wrong bell is a different answer and never an
// ugly noise — which matters in a toy where being wrong has to feel survivable.
export const BELLS = ["do", "re", "mi", "sol", "la"];

/** C5, D5, E5, G5, A5 — a major pentatonic, so nothing can clash. */
export const PITCH = { do: 523.25, re: 587.33, mi: 659.25, sol: 783.99, la: 880 };

/** The phrase the tower works up to, one bell longer each round. Six is where a
 *  phrase stops being a shape you hear and starts being a list you memorise. */
export const LENGTH = 6;

/** How a round is judged. Three answers and none of them is a loss:
 *   "ok"    — right so far, still more to ring
 *   "done"  — the whole phrase given back
 *   "wrong" — a different bell, which costs a replay and nothing else
 *
 *  A mistake is a rewind everywhere in this valley, so it is a rewind here: the
 *  tower simply rings the phrase again and you start the round over. Nothing is
 *  taken away, and the phrase never shortens. */
export const judge = (phrase, played) => {
  for (const [i, note] of played.entries()) if (note !== phrase[i]) return "wrong";
  return played.length === phrase.length ? "done" : "ok";
};

/** Grow the phrase by one bell. `pick` is a number in 0..1 from the caller, so
 *  this stays pure and the place owns where its randomness comes from — which is
 *  also what lets a half-rung phrase be written down and read back. */
export const grow = (phrase, pick) => [...phrase, BELLS[Math.min(BELLS.length - 1, Math.floor(pick * BELLS.length))]];

export const solved = (phrase) => phrase.length >= LENGTH;
