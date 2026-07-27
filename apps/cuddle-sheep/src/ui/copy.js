// Everything the game says, in one place.
//
// It was inline at seventy-five call sites, which is defensible — a sentence next to
// the moment it is said is easy to read — but it meant nobody had ever read the whole
// script as one voice. Doing that found three things in ten minutes:
//
//   * every unlock still said "suis le panneau", follow the SIGNPOST, two commits
//     after the signpost was replaced by flagstones at the borders;
//   * "Retour au pré." was written out six times, once per place;
//   * le clocher announced itself "au bout de la vallée" while standing at road 3 of 5,
//     which la lisière — actually at the end — said too.
//
// Hints are `[français, english]` and spread into setHint, so a call site reads
// `setHint(...say.pont.crowded)`. Announcements are French alone, because the live
// region is what a screen reader speaks and the document is lang="fr". Anything with
// a number in it is a function rather than a template, so the shape of the sentence
// lives here with its siblings instead of at the call site.
//
// The rule for adding to it: if a player can read or hear it, it belongs here.

/** Said in every place, so written once. */
export const HOME_AGAIN = "Retour au pré.";

/** A place opening, in the shape they all share. `far` is true only for the last one. */
const opens = (what, far = false) =>
  `${what} est ouvert${what.startsWith("La ") || what.startsWith("la ") ? "e" : ""}, ${
    far ? "au bout de" : "plus loin dans"} la vallée : le chemin y mène.`;

export const say = {
  /* ---- the meadow, and the care that happens there ---- */
  him: {
    happy: "Nuage sourit : il est heureux pour cinq minutes.",
    happyAgain: "Câlin renouvelé : cinq minutes de plus.",
    windowClosed: "Les cinq minutes sont passées : Nuage boude de nouveau.",
    again: ["Encore un câlin ?", "another cuddle?"],
  },
  clover: {
    topUp: "Nuage croque le trèfle : trente secondes de bonheur en plus.",
    noWindow: "Nuage croque le trèfle, mais ce sont les câlins qui le rendent heureux.",
  },
  wool: {
    tooShort: ["Sa laine est trop courte — elle repousse", "his wool is too short — it is growing back"],
    tooShortSaid: "Sa laine est trop courte pour la tonte.",
    inHand: ["Passe les ciseaux sur sa laine", "run the shears over his wool"],
    inHandSaid: "Ciseaux en main. Passe-les sur sa laine pour le tondre.",
    shorn: "La toison est tombée : Nuage est tout neuf, et un peu frileux.",
    shornHint: ["Nuage est tondu — trois câlins avant la prochaine tonte",
      "Nuage is shorn — three cuddles before the next shearing"],
    settleFirst: ["Rassure-le d'abord — un câlin, puis la tonte",
      "settle him first — a cuddle, then the shears"],
    settleFirstSaid: "Nuage se dérobe : il faut d'abord le rassurer avec un câlin.",
  },

  /* ---- the two doors the meadow has ---- */
  sprout: {
    grown: ["Un trèfle à quatre feuilles — touche-le", "a four-leaf clover — tap it"],
    grownSaid: "Un trèfle à quatre feuilles a poussé dans le pré : touche-le pour la traversée.",
  },
  gate: {
    open: ["La grange est ouverte — trois toisons y sont rangées",
      "the barn is open — three fleeces are stored there"],
    openSaid: "La grange s'ouvre au fond du pré : trois toisons y attendent d'être empilées.",
  },

  /* ---- walking, and the map ---- */
  road: {
    setOff: (where) => `Nuage part vers ${where}.`,
    home: HOME_AGAIN,
  },
  carte: {
    how: ["Touche un endroit pour y aller — Échap pour revenir",
      "touch a place to go there — Escape to come back"],
    said: (names, here) => `La carte de la vallée : ${names}. Nuage est à ${here}.`,
  },

  /* ---- la rivière ---- */
  riviere: {
    how: ["Le loup mange le mouton, le mouton mange le chou — une seule place dans la barque",
      "wolf eats sheep, sheep eats cabbage — one seat in the boat"],
    banks: (left, right, side, cargo) =>
      `Rive gauche : ${left}. Rive droite : ${right}. La barque est à ${side}.${cargo}`,
    wolfAte: "Le loup a fait un câlin non autorisé au mouton. Annule le dernier passage.",
    wolfAteHint: ["Le loup et le mouton, seuls…", "wolf and sheep, left alone…"],
    sheepAte: "Le mouton a mangé le chou. Annule le dernier passage.",
    sheepAteHint: ["Le mouton et le chou, seuls…", "sheep and cabbage, left alone…"],
    won: (n, best) => `Tout le monde est passé en ${n} passages.${best}`,
    wonHint: (n, best) => [`Tout le monde est passé — ${n} passages${best ? ", le minimum" : ""}`,
      `everyone crossed in ${n}${best ? " — the minimum" : ""}`],
  },

  /* ---- la grange ---- */
  grange: {
    how: ["Empile les trois ballots sur le dernier pieu — jamais un gros sur un petit",
      "stack all three on the last post — never a big one on a small one"],
    posts: (list, held) => `${list}.${held}`,
    empty: ["Ce pieu est vide", "that post is empty"],
    tooBig: ["Un gros ballot écraserait le petit", "a big bale would flatten a small one"],
    tooBigSaid: "Trop gros pour ce pieu : pose-le ailleurs.",
    won: (n, best) => `Les trois ballots sont sur le dernier pieu, en ${n} déplacements.${best}`,
    wonHint: (n, best) => [`Rangé en ${n} déplacements${best ? ", le minimum" : ""}`,
      `stacked in ${n}${best ? " — the minimum" : ""}`],
  },

  /* ---- le pont ---- */
  pont: {
    how: ["Deux au plus, et la lanterne va avec eux — on marche au pas du plus lent",
      "two at a time, and the lantern goes with them — you walk at the slower one's pace"],
    sides: (here, there, lantern, chosen) =>
      `De ce côté : ${here}. De l'autre : ${there}. La lanterne est de ${lantern}.${chosen}`,
    across: (who, whoEn) => [`${who} est de l'autre côté`, `${whoEn} is on the other side`],
    nobody: ["Choisis qui porte la lanterne", "pick who carries the lantern"],
    nobodySaid: "Personne ne peut traverser sans la lanterne : choisis d'abord.",
    crowded: ["Les planches n'en portent que deux", "the planks take only two"],
    crowdedSaid: "Deux au plus sur les planches.",
    won: (n, best) => `Tout le monde est passé en ${n} minutes.${best}`,
    wonHint: (n, best) => [`Tous passés en ${n} minutes${best ? ", le minimum" : ""}`,
      `all across in ${n} minutes${best ? " — the minimum" : ""}`],
    opens: opens("Le pont"),
    opensHint: ["Une lanterne s'allume plus loin dans la vallée — le pont",
      "a lantern is lit further down the valley — the bridge"],
  },

  /* ---- le clocher ---- */
  clocher: {
    yourTurn: ["À toi — tire les cordes dans le même ordre",
      "your turn — pull the ropes in the same order"],
    singing: (n) => `Le clocher sonne ${n} cloche${n > 1 ? "s" : ""}. Écoute, puis rends-la${n > 1 ? "-lui" : ""}.`,
    wrong: ["Pas celle-là — réécoute", "not that one — listen again"],
    wrongSaid: (bell) => `Ce n'était pas ${bell}. Le clocher recommence la phrase.`,
    longer: (n) => [`${n} cloches, maintenant`, `${n} bells now`],
    won: (phrase, clean) => `La phrase entière est rendue : ${phrase}.${clean}`,
    wonHint: (n, clean) => [`La phrase entière, ${n} cloches${clean ? " — sans une reprise" : ""}`,
      `the whole phrase, ${n} bells${clean ? " — first time" : ""}`],
    opens: opens("Le clocher"),
    opensHint: ["Des cloches, plus loin dans la vallée — le clocher",
      "bells, further down the valley — the bell tower"],
  },

  /* ---- la clôture ---- */
  cloture: {
    how: ["Allume les sept — un poteau réveille aussi ses voisins",
      "light all seven — a post wakes its neighbours too"],
    lit: (on, total, dark) => (on === total
      ? "Les sept lanternes sont allumées."
      : `${on} lanterne${on > 1 ? "s" : ""} sur ${total}. Éteinte${dark.length > 1 ? "s" : ""} : ${dark.join(", ")}.`),
    won: (n, best) => `Les sept lanternes sont allumées, en ${n} touches.${best}`,
    wonHint: (n, best) => [`Toute la clôture éclairée en ${n} touches${best ? ", le minimum" : ""}`,
      `the whole fence lit in ${n}${best ? " — the minimum" : ""}`],
    opens: opens("La clôture"),
    opensHint: ["Une clôture de lanternes, plus loin — la clôture",
      "a fence of lanterns, further on — the fence"],
  },

  /* ---- la lisière ---- */
  lisiere: {
    how: ["Rassemble les trois poules sous la garde du chien — il surveille trois cases",
      "gather all three hens where the dog can watch — he sees three boxes at once"],
    watching: (from, to, boxes, safe, total, held) =>
      `Le chien surveille les cases ${from} à ${to}. Poules en case ${boxes} — ${safe} sur ${total} à l'abri.${held}`,
    pickFirst: ["Choisis d'abord une poule, ou le chien", "pick a hen first, or the dog"],
    taken: ["Cette case est déjà prise", "that box is taken"],
    takenSaid: "Une autre poule occupe cette case.",
    already: ["Elle y est déjà", "she is already there"],
    alreadySaid: "Elle est déjà dans cette case.",
    won: (n, best) => `Les trois poules sont sous la garde du chien, en ${n} pas.${best}`,
    wonHint: (n, best) => [`Toutes gardées en ${n} pas${best ? ", le minimum" : ""}`,
      `all watched in ${n}${best ? " — the minimum" : ""}`],
    // the only place that really IS at the end of the road
    opens: opens("La lisière", true),
    opensHint: ["Un chien vous attend à la lisière du bois",
      "a dog is waiting at the edge of the wood"],
  },
};
