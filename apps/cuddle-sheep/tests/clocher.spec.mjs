// Le clocher: the tower rings a phrase and you give it back. What this spec has
// to protect above everything is that being wrong costs nothing — the phrase
// never shortens, nothing is taken away, and the tower simply says it again.
//
// The phrase is random, so the spec listens for it the way a player does: by
// watching which bell is struck, in order. Nothing here reads the game's state.
import { BELLS } from "../src/puzzles/carillon.js";

const NOON = "2026-06-21T12:00:00";

const SAVE = (over = {}) => ({
  "nuage:save": JSON.stringify({
    v: 4,
    sheep: { happyUntil: 0, woolFrom: Date.now() - 60 * 1000 },
    care: { fed: 5, shorn: 3 },
    valley: { at: "pre", visited: ["pre"], unlocked: ["riviere", "grange"], solves: {}, boards: {} },
    prefs: { sound: false },
    ...over,
  }),
});

const boot = async (page, APP, save) => {
  await page.clock.setFixedTime(new Date(NOON));
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, String(v));
  }, save);
  await page.goto(APP);
  await page.waitForTimeout(1000);
};

const wayNames = (page) => page.evaluate(() =>
  [...document.querySelectorAll(".edge__name")].map((t) => t.textContent));

const readout = (page) => page.locator("#bellRound").innerText();
const live = (page) => page.locator("#live").innerText();

/** Listen to the tower. Records the order the bells are struck in, by polling for
 *  the short `struck` window each strike raises — so a phrase that rings the same
 *  bell twice comes back as two entries and not one. */
const listen = async (page, want) => {
  const heard = [];
  const wasStruck = new Set();
  const t0 = Date.now();
  while (heard.length < want && Date.now() - t0 < want * 1000 + 4000) {
    const nowStruck = await page.evaluate(() =>
      [...document.querySelectorAll(".bell.struck")].map((b) => b.dataset.bell));
    for (const id of nowStruck) if (!wasStruck.has(id)) heard.push(id);
    wasStruck.clear();
    for (const id of nowStruck) wasStruck.add(id);
    await page.waitForTimeout(50);
  }
  return heard;
};

/** Wait until it is his turn to pull the ropes. */
const myTurn = async (page, cap = 9000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < cap) {
    if (await page.locator("#rope-do").evaluate((n) => !n.hasAttribute("disabled"))) return true;
    await page.waitForTimeout(100);
  }
  return false;
};

/** Ask the tower to say it again, and listen from the first stroke. Costs a
 *  replay, which is a tally that fills and never a penalty. */
const hear = async (page, want) => {
  await page.locator("#bellAgain").click();
  const heard = await listen(page, want);
  await myTurn(page, 12000);
  return heard;
};

/** Ring a phrase back, one rope at a time. */
const giveBack = async (page, phrase) => {
  for (const id of phrase) {
    await page.locator(`#rope-${id}`).dispatchEvent("pointerdown");
    await page.waitForTimeout(300);
  }
};

export default async ({ newPage, check, APP }) => {
  /* ---- the door: earned by stacking the barn, and it opens onto the borders ---- */
  let page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, SAVE());
  await page.keyboard.press("j");
  await page.waitForTimeout(1500);
  check("an unstacked barn does not ring the bells",
    !(await wayNames(page)).includes("le clocher"), (await wayNames(page)).join("|"));
  await page.close();

  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, SAVE({
    valley: {
      at: "clocher", visited: ["pre", "clocher"],
      unlocked: ["riviere", "grange", "clocher"], solves: { grange: 1 }, boards: {},
    },
  }));
  await page.waitForTimeout(700);
  check("a reload puts him back in the tower",
    (await page.evaluate(() => document.documentElement.dataset.mode)) === "bells",
    await page.evaluate(() => document.documentElement.dataset.mode ?? "none"));
  const bands = await page.evaluate(() =>
    [...document.querySelectorAll("#valleyBack > g, #valleyFront > g")].map((g) => g.id).sort().join(","));
  check("and no other diorama is left in the document", bands === "back-clocher,front-clocher", bands);
  check("there is a rope for every bell", (await page.locator(".rope").count()) === BELLS.length);

  /* ---- the tower leads, and hands over ---- */
  // It rings on arrival, ~620ms after landing — long before a spec can get a
  // listener in. So the phrase is always ASKED for here, which is deterministic
  // and is also the affordance a player who missed it would reach for.
  check("the tower takes the lead, then hands over", await myTurn(page));
  const first = await hear(page, 1);
  check("the tower rings a bell", first.length === 1 && BELLS.includes(first[0]), first.join(","));

  /* ---- THE check: a wrong bell is a rewind, never a loss ---- */
  const wrong = BELLS.find((b) => b !== first[0]);
  await page.locator(`#rope-${wrong}`).dispatchEvent("pointerdown");
  // Read the live region BEFORE listening for the replay. The tower announces
  // itself when it starts singing again, so the "that was not it" sentence is
  // rightly superseded within the second — a listen() here reads the wrong line.
  await page.waitForTimeout(350);
  check("a wrong bell says so", (await live(page)).includes("Ce n'était pas"), await live(page));
  check("and the phrase does not shorten", (await readout(page)).startsWith("1 cloche"), await readout(page));
  // by now the mistake's own strike has faded (the window is 260ms), so what is
  // heard next is the tower saying the phrase over
  const heard = await listen(page, 1);
  check("the tower simply says it again", heard.length === 1 && heard[0] === first[0],
    `heard ${heard.join(",")}, phrase was ${first[0]}`);
  check("and it is his turn once more", await myTurn(page, 12000));

  /* ---- give it back, and the phrase grows ---- */
  await giveBack(page, first);
  await page.waitForTimeout(1600);
  check("giving it back grows the phrase", (await readout(page)).startsWith("2 cloche"), await readout(page));

  /* ---- play it out to the end: six bells, listened to and given back ---- */
  let solvedIt = false;
  for (const want of [2, 3, 4, 5, 6]) {
    if (!(await myTurn(page, 12000))) break;
    const phrase = await hear(page, want);
    if (phrase.length !== want) break;
    await giveBack(page, phrase);
    await page.waitForTimeout(1700);
    if ((await live(page)).includes("La phrase entière")) { solvedIt = true; break; }
  }
  check("the whole phrase can be given back", solvedIt, await live(page));
  check("and the solve is remembered",
    (await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")).valley.solves.clocher)) === 1);

  /* ---- leaving is always one border away, even on a solved board ---- */
  check("the way home is never taken away", (await page.locator('.edge[data-dir="0"]').count()) === 1);
  await page.locator('.edge[data-dir="0"]').click();
  await page.waitForTimeout(900);
  check("and the tower is left for the meadow",
    (await page.evaluate(() => document.documentElement.dataset.mode)) === undefined);
  check("and the save says so",
    (await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")).valley.at)) === "pre");
  await page.close();
};
