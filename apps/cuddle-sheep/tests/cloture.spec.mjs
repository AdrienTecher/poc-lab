// La clôture: touching a post wakes its neighbours, the board fills rather than
// empties, and every fence it hands out can be finished.
//
// That last one is the promise worth testing hardest. A lights-out board made by
// scattering lanterns can be unfinishable, and a comfort toy must never give you
// one — so the board is made by unlighting a solved fence, and the spec checks
// the property rather than trusting the construction.
import { POSTS, toggle, solved, fewest, remaining, start } from "../src/puzzles/cloture.js";
import { patch, liveBands, peeking } from "./helpers.mjs";

const NOON = "2026-06-21T12:00:00";
const SCENE = { x: 160, y: 100, width: 960, height: 480 };

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

/** Which lanterns are burning, read off the class the renderer actually wrote. */
const lit = (page) => page.evaluate(() =>
  [...document.querySelectorAll(".lamppost")].map((n) => n.classList.contains("lit")));

const touches = (page) => page.locator("#fenceTouches").innerText();

const separation = async (page, box) => {
  const hold = (m) => page.evaluate((v) => document.documentElement.style.setProperty("--m", String(v)), m);
  await hold(0); const sad = await patch(page, box);
  await hold(1); const happy = await patch(page, box);
  return Math.hypot(...sad.map((c, i) => c - happy[i]));
};

export default async ({ newPage, check, APP }) => {
  /* ---- the rules, before any world is involved ---- */
  // 128 boards is the whole space, so there is no reason to sample it
  let unsolvable = 0, wrongAnswer = 0;
  for (const m of [...Array(128).keys()]) {
    const board = [...Array(POSTS).keys()].map((i) => !!(m & (1 << i)));
    const x = remaining(board);
    if (!x) { unsolvable++; continue; }
    let after = board;
    x.forEach((v, i) => { if (v) after = toggle(after, i); });
    if (!solved(after)) wrongAnswer++;
  }
  check("every fence there is can be finished", unsolvable === 0, `${unsolvable} of 128 cannot`);
  check("and the stated answer finishes it", wrongAnswer === 0, `${wrongAnswer} of 128 wrong`);

  // uniqueness is what lets a minimum be claimed at all: with a spare kernel
  // vector there would be two different shortest answers
  const sample = [...Array(POSTS).keys()].map((i) => i % 3 === 0);
  let count = 0;
  for (const s of [...Array(128).keys()]) {
    let b = sample;
    for (const i of [...Array(POSTS).keys()]) if (s & (1 << i)) b = toggle(b, i);
    if (solved(b)) count++;
  }
  check("the answer is unique, so the minimum is real", count === 1, `${count} answers`);

  let handedOutSolved = 0, handedOutBroken = 0;
  for (const k of [...Array(200).keys()]) {
    const board = start(Math.random, 4 + (k % 3));
    if (solved(board)) handedOutSolved++;
    if (fewest(board) === null) handedOutBroken++;
  }
  check("a new fence is never already lit", handedOutSolved === 0, `${handedOutSolved} of 200`);
  check("and never unfinishable", handedOutBroken === 0, `${handedOutBroken} of 200`);

  /* ---- the door ---- */
  let page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, SAVE());
  await page.keyboard.press("j");
  await page.waitForTimeout(1500);
  const shut = await page.evaluate(() =>
    [...document.querySelectorAll("g[data-layer]:not([inert]) .edge__name")].map((t) => t.textContent));
  check("an unwalked bridge does not find the fence", !shut.includes("la clôture"), shut.join("|"));
  await page.close();

  /* ---- the fence itself ---- */
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, SAVE({
    valley: {
      at: "cloture", visited: ["pre", "cloture"],
      unlocked: ["riviere", "grange", "pont", "cloture"], solves: { pont: 1 }, boards: {},
    },
  }));
  await page.waitForTimeout(700);
  check("a reload puts him back at the fence",
    (await page.evaluate(() => document.documentElement.dataset.mode)) === "fence",
    await page.evaluate(() => document.documentElement.dataset.mode ?? "none"));
  const bands = await page.evaluate(() =>
    [...document.querySelectorAll("#valleyBack > g, #valleyFront > g")].map((g) => g.id).sort().join(","));
  // Invariant 9 changed shape: a sleeping place still leaves the document, but the
  // two open NEIGHBOURS stay, inert, so the valley reads as continuous in the
  // letterbox margins. What must still be gone is anything further than one step.
  check("its open neighbour is here too, and nothing further",
    (await liveBands(page)).join(",") === "cloture,pont", (await liveBands(page)).join(","));
  // la lisière needs le clocher solved and this save has not, so the fence is the end of
  // the road here and its only neighbour is the bridge
  check("and it is only being looked at",
    (await peeking(page)).join(",") === "pont", (await peeking(page)).join(","));

  const before = await lit(page);
  check("and the fence starts part-lit", before.some(Boolean) && !before.every(Boolean),
    JSON.stringify(before));

  /* ---- a post wakes its neighbours, and only those ---- */
  await page.keyboard.press("4");                  // the middle post
  await page.waitForTimeout(400);
  const after = await lit(page);
  const flipped = before.map((v, i) => v !== after[i]);
  check("touching a post wakes it and both neighbours",
    flipped.every((v, i) => v === (Math.abs(i - 3) <= 1)), JSON.stringify(flipped));
  check("and it counts as one touch", (await touches(page)) === "1 touche", await touches(page));

  /* ---- undo, and touching twice is its own undo ---- */
  await page.locator("#fenceUndo").click();
  await page.waitForTimeout(400);
  check("undo puts the lanterns back", JSON.stringify(await lit(page)) === JSON.stringify(before));

  await page.keyboard.press("4");
  await page.waitForTimeout(300);
  await page.keyboard.press("4");
  await page.waitForTimeout(400);
  check("touching a post twice is the same as not touching it",
    JSON.stringify(await lit(page)) === JSON.stringify(before), JSON.stringify(await lit(page)));
  // two, not three: the undo above put the counter back with the lanterns. What
  // matters is that returning the board to where it started still COST two —
  // the tally fills even when the fence does not, because nothing here counts down
  check("but the touches still count, because nothing here counts down",
    (await touches(page)) === "2 touches", await touches(page));

  /* ---- solve it by following the answer the rules give ---- */
  await page.locator("#fenceReset").click();
  await page.waitForTimeout(600);
  const fresh = await lit(page);
  const answer = remaining(fresh);
  check("a fresh fence comes with an answer", answer !== null, JSON.stringify(fresh));
  for (const [i, v] of answer.entries()) {
    if (!v) continue;
    await page.keyboard.press(String(i + 1));
    await page.waitForTimeout(280);
  }
  await page.waitForTimeout(800);
  check("following it lights every lantern", (await lit(page)).every(Boolean), JSON.stringify(await lit(page)));
  const live = await page.locator("#live").innerText();
  check("and the fence says so", live.includes("sept lanternes sont allumées"), live);
  check("in the fewest touches", live.includes("minimum"), live);
  check("the solve is remembered",
    (await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")).valley.solves.cloture)) === 1);

  /* ---- outdoors, so it borrows the valley's sky and adds no grade ---- */
  const grades = await page.evaluate(() => ({
    dusk: Number(getComputedStyle(document.querySelector(".grade--dusk")).opacity),
    night: Number(getComputedStyle(document.querySelector(".grade--night")).opacity),
  }));
  check("the fence lays no grade over the scene", grades.dusk === 0 && grades.night === 0,
    JSON.stringify(grades));
  const fenceSep = await separation(page, SCENE);
  await page.evaluate(() => document.documentElement.style.removeProperty("--m"));

  /* ---- leaving is always one border away, even on a solved board ---- */
  check("the way home is never taken away", (await page.locator('g[data-layer]:not([inert]) .edge[data-dir="0"]').count()) === 1);
  await page.locator('g[data-layer]:not([inert]) .edge[data-dir="0"]').click();
  await page.waitForTimeout(900);
  check("and the fence is left for the meadow",
    (await page.evaluate(() => document.documentElement.dataset.mode)) === undefined);
  await page.close();

  // the same yardstick le pont uses: the dimmest place already built
  const barn = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(barn, APP, SAVE({
    valley: { at: "grange", visited: ["pre", "grange"], unlocked: ["riviere", "grange"], solves: { riviere: 1 }, boards: {} },
  }));
  await barn.waitForTimeout(600);
  const barnSep = await separation(barn, SCENE);
  await barn.evaluate(() => document.documentElement.style.removeProperty("--m"));
  await barn.close();
  check("and his mood reads as far along the fence as anywhere already built",
    fenceSep > barnSep * 0.9, `${fenceSep.toFixed(1)} at the fence vs ${barnSep.toFixed(1)} in the barn`);
};
