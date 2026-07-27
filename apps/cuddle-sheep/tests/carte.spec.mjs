// La carte: the valley seen from far enough back to see all of it.
//
// The claim worth testing is not "a panel opens" — it is that the map is the WORLD.
// So it checks the real dioramas are what is on screen, that only what he has opened
// is there, and that the state he left a place in is visible from the map. An
// illustrated world map could pass none of those.
const SAVE = (over = {}) => JSON.stringify({
  v: 4, sheep: { happyUntil: Date.now() + 200000, woolFrom: Date.now() - 200000 },
  care: { fed: 5, shorn: 3 },
  valley: {
    at: "pont", visited: ["pre", "riviere", "grange", "pont"],
    unlocked: ["riviere", "grange", "pont", "clocher", "cloture", "lisiere"],
    solves: { riviere: 1, grange: 1, pont: 1, clocher: 1 }, boards: {}, ...over,
  },
  prefs: { sound: false },
});

const boot = async (page, APP, save) => {
  await page.addInitScript((s) => localStorage.setItem("nuage:save", s), save);
  await page.goto(APP);
  await page.waitForTimeout(1700);
};

const shot = (page) => page.evaluate(() => {
  const [x, , w] = document.querySelector("#valleyFront").getAttribute("viewBox").split(" ").map(Number);
  return { x, w };
});
const bands = (page) => page.evaluate(() =>
  new Set([...document.querySelectorAll("#valleyBack > g[data-layer], #valleyFront > g[data-layer]")]
    .map((g) => g.id.replace(/^(back|front)-/, ""))).size);
// ordinarily le pont plus its two neighbours; the map is the one view that holds all six
const AT_REST = 3;
const names = (page) => page.evaluate(() =>
  [...document.querySelectorAll(".carte__name")].map((t) => t.textContent));

/** Poll until the shot is back to one place wide. The width is a SPRING, so it
 *  approaches 728 asymptotically — an assertion at a fixed moment reads 730 on a busy
 *  machine and 729 on an idle one, which is a coin toss rather than a test. */
const narrowAgain = async (page, cap = 6000) => {
  const t0 = Date.now();
  let w = (await shot(page)).w;
  while (Date.now() - t0 < cap) {
    if (Math.abs(w - 728) < 4) return w;
    await page.waitForTimeout(150);
    w = (await shot(page)).w;
  }
  return w;
};

export default async ({ newPage, check, APP }) => {
  /* ---- there is nothing to map from the meadow ---- */
  let page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, SAVE({ at: "pre" }));
  check("no map from the meadow, because the valley is not where he is",
    !(await page.locator("#mapBtn").isVisible()));
  await page.close();

  /* ---- and it is offered from a place ---- */
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, SAVE());
  check("the map is offered from a place", await page.locator("#mapBtn").isVisible());
  const closed = await shot(page);
  check("and the shot starts one place wide", Math.abs(closed.w - 728) < 2, `${closed.w}`);
  check("with him and his two neighbours in the document",
    (await bands(page)) === AT_REST, String(await bands(page)));

  await page.locator("#mapBtn").click();
  await page.waitForTimeout(1500);

  /* ---- THE claim: what is on screen is the real places ---- */
  const wideShot = await shot(page);
  check("opening it widens the shot to hold the whole valley", wideShot.w > 728 * 5,
    `${Math.round(wideShot.w)} units wide`);
  check("and every opened place is genuinely in the document, not drawn again",
    (await bands(page)) === 6, String(await bands(page)));
  check("each one is named, in road order",
    (await names(page)).join("|") === "la rivière|la grange|le pont|le clocher|la clôture|la lisière",
    (await names(page)).join("|"));
  const marked = () => page.evaluate(() =>
    document.querySelector(".carte__spot.here .carte__name")?.textContent ?? "none");
  check("and the one he is in is marked", (await marked()) === "le pont", await marked());
  // this is the part an illustration cannot do: the fence's own lanterns are on
  // screen, in whatever state he left them
  check("the places show their real contents, because they ARE the places",
    (await page.locator(".lamppost").count()) === 7 && (await page.locator(".bale").count()) === 3,
    `${await page.locator(".lamppost").count()} lanterns, ${await page.locator(".bale").count()} bales`);

  /* ---- Escape closes the map without leaving the place ---- */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
  check("Escape closes the map", (await page.locator(".carte__name").count()) === 0);
  check("and does not leave the place with it",
    (await page.evaluate(() => document.documentElement.dataset.mode)) === "bridge",
    await page.evaluate(() => document.documentElement.dataset.mode ?? "none"));
  const backAgain = await narrowAgain(page);
  check("and the shot is one place wide again", Math.abs(backAgain - 728) < 4, `${backAgain}`);
  check("and the far places out of the document again, leaving only the neighbours",
    (await bands(page)) === AT_REST, String(await bands(page)));

  /* ---- and touching a place walks him there ---- */
  await page.keyboard.press("m");
  await page.waitForTimeout(1400);
  const far = page.locator(".carte__spot", { has: page.locator("text=la lisière") });
  const b = await far.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.5);
  await page.waitForTimeout(5000);
  check("touching a place on the map takes him to it",
    (await page.evaluate(() => document.documentElement.dataset.mode)) === "edge",
    await page.evaluate(() => document.documentElement.dataset.mode ?? "none"));
  check("and the map closed itself on the way", (await page.locator(".carte__name").count()) === 0);
  await page.close();

  /* ---- a place he has not opened is not on the map ---- */
  const few = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(few, APP, SAVE({ at: "riviere", unlocked: ["riviere", "grange"], solves: {} }));
  await few.locator("#mapBtn").click();
  await few.waitForTimeout(1400);
  check("only what he has opened is on the map",
    (await names(few)).join("|") === "la rivière|la grange", (await names(few)).join("|"));
  await few.close();

  /* ---- and it works with motion turned down ---- */
  const calm = await newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await boot(calm, APP, SAVE());
  await calm.locator("#mapBtn").click();
  await calm.waitForTimeout(500);
  const snapped = await shot(calm);
  check("with reduced motion the map arrives at once rather than gliding",
    snapped.w > 728 * 5, `${Math.round(snapped.w)} after 500ms`);
  await calm.close();
};
