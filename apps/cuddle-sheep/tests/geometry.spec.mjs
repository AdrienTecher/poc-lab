// Protects the window-sizing class of bug: a sheep cut off by a short window, a
// hint line that makes the page scroll sideways, chrome that overlaps chrome, a
// control bar off the bottom, a way out of a place you cannot reach.
//
// It used to walk two rooms — the meadow and la rivière — because at the time
// there were two. There are six places now, and five of them had never been looked
// at on a phone. Every one is checked at every viewport, because a diorama is
// authored in tile space and the letterbox solve is the only thing standing
// between that and a 320px screen.
import { geometryIssues, VIEWPORTS } from "./helpers.mjs";

const PLACES = [
  ["la rivière", "riviere", "cross"], ["la grange", "grange", "barn"],
  ["le pont", "pont", "bridge"], ["le clocher", "clocher", "bells"],
  ["la clôture", "cloture", "fence"], ["la lisière", "lisiere", "edge"],
];

/** Everything open and every puzzle solved once, so every border that can be drawn
 *  is drawn: a way on, a way back, and the way home. */
const SAVE = (at) => JSON.stringify({
  v: 4,
  sheep: { happyUntil: 0, woolFrom: Date.now() - 60 * 1000 },
  care: { fed: 5, shorn: 3 },
  valley: {
    at,
    visited: ["pre", "riviere", "grange", "pont", "clocher", "cloture", "lisiere"],
    unlocked: ["riviere", "grange", "pont", "clocher", "cloture", "lisiere"],
    solves: { riviere: 1, grange: 1, pont: 1, clocher: 1, cloture: 1, lisiere: 1 },
    boards: {},
  },
  prefs: { sound: false },
});

export default async ({ newPage, check, APP }) => {
  for (const [name, width, height] of VIEWPORTS) {
    const page = await newPage({ viewport: { width, height } });
    // seeded per load, so each place is entered directly rather than walked to —
    // the geometry of arriving is the same either way and this is ten times faster
    await page.addInitScript(() => {
      const at = sessionStorage.getItem("spec:at") ?? "pre";
      localStorage.setItem("nuage:save", sessionStorage.getItem(`spec:save:${at}`) ?? "");
    });

    for (const [label, id, want = "meadow"] of [["meadow", "pre"], ...PLACES]) {
      await page.goto(APP);
      await page.evaluate(([place, blob]) => {
        sessionStorage.setItem("spec:at", place);
        sessionStorage.setItem(`spec:save:${place}`, blob);
      }, [id, SAVE(id)]);
      await page.reload();
      // long enough for the crossing curtain to have swept and settled
      await page.waitForTimeout(1500);

      // Assert we ARE where we think we are before measuring it. If the seeding
      // ever stops working every room silently becomes the meadow, and seventy
      // checks pass while testing one screen — which is the exact shape of the
      // vacuous assertion this suite has already been caught by once.
      const mode = await page.evaluate(() => document.documentElement.dataset.mode ?? "meadow");
      check(`${name} · ${label} is actually open`, mode === want, `expected ${want}, in ${mode}`);

      const issues = await geometryIssues(page);
      check(`${name} · ${label} fits`, issues.length === 0, `[${mode}] ${issues.join(" | ")}`);
    }

    await page.close();
  }
};
