// Reduced motion: with it asked for, nothing in this world should still be moving.
//
// Checked by asking the browser what it is animating — document.getAnimations() is
// the compositor's own list, so this cannot drift the way a list of selectors does.
// It was a list of selectors, and the list named eight things and missed ten.
const SAVE = (at) => JSON.stringify({
  v: 4, sheep: { happyUntil: Date.now() + 200000, woolFrom: Date.now() - 800000 },
  care: { fed: 5, shorn: 3 },
  valley: {
    at, visited: ["pre", "riviere", "grange", "pont", "clocher", "cloture", "lisiere"],
    unlocked: ["riviere", "grange", "pont", "clocher", "cloture", "lisiere"],
    solves: { riviere: 1, grange: 1, pont: 1, clocher: 1, cloture: 1, lisiere: 1 }, boards: {},
  },
  prefs: { sound: false },
});

/** Whatever the compositor still has running, named so a failure is actionable. */
const running = (page) => page.evaluate(() => document.getAnimations()
  .filter((a) => a.playState === "running")
  .map((a) => {
    const t = a.effect?.target;
    const name = a.animationName ?? a.transitionProperty ?? "?";
    const who = t?.id || t?.getAttribute?.("class") || t?.tagName || "?";
    return `${name}@${who}`;
  }));

export default async ({ newPage, check, APP }) => {
  /* ---- with motion allowed, the world IS alive — or the check below is empty ---- */
  const lively = await newPage({ viewport: { width: 1280, height: 800 } });
  await lively.addInitScript((s) => localStorage.setItem("nuage:save", s), SAVE("pre"));
  await lively.goto(APP);
  await lively.waitForTimeout(1400);
  const alive = await running(lively);
  check("with motion allowed, things are moving", alive.length > 0,
    "if nothing animates here the calm check below proves nothing");
  await lively.close();

  /* ---- and with it turned down, in every room ---- */
  for (const [label, at] of [["the meadow", "pre"], ["la rivière", "riviere"], ["la grange", "grange"],
    ["le pont", "pont"], ["le clocher", "clocher"], ["la clôture", "cloture"], ["la lisière", "lisiere"]]) {
    const page = await newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
    await page.addInitScript((s) => localStorage.setItem("nuage:save", s), SAVE(at));
    await page.goto(APP);
    await page.waitForTimeout(1600);
    const still = await running(page);
    check(`nothing is still moving in ${label}`, still.length === 0, still.slice(0, 6).join(", "));
    await page.close();
  }

  /* ---- and the things motion was carrying still happen ---- */
  // Reduced motion must not mean reduced GAME. Travel snaps rather than walking, the
  // fleece curtain is never built at all — but he still gets where he is going.
  const calm = await newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await calm.addInitScript((s) => localStorage.setItem("nuage:save", s), SAVE("riviere"));
  await calm.goto(APP);
  await calm.waitForTimeout(1500);
  check("he is still where the save left him",
    (await calm.evaluate(() => document.documentElement.dataset.mode)) === "cross");
  const east = await calm.locator('.edge[data-dir="1"]').boundingBox();
  await calm.mouse.click(east.x + east.width / 2, east.y + east.height / 2);
  await calm.waitForTimeout(2200);
  check("and travel still arrives, without the walk",
    (await calm.evaluate(() => document.documentElement.dataset.mode)) === "barn",
    await calm.evaluate(() => document.documentElement.dataset.mode ?? "none"));
  check("and no curtain was built to cover it",
    (await calm.locator(".puffs").count()) === 0);
  const afterTravel = await running(calm);
  check("and arriving left nothing looping", afterTravel.length === 0, afterTravel.slice(0, 6).join(", "));
  await calm.close();
};
