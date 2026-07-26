// Le pont: the lantern goes with whoever walks, two planks' width means two, the
// minutes only ever add up — and the dark in here costs his mood nothing.
//
// That last one is the reason this spec measures pixels. Le pont is meant to read
// as dusk, and the cheap way to get dusk is a grade over the scene — which would
// scale the gap between the happy palette and the sad one by the same factor it
// scales the palette, because k·a − k·b = k(a−b). That gap is what --m means.
// day.spec guards it for the meadow's sky; nothing guarded it for a place, and a
// place is free to introduce its own darkness. So this does.
import { patch } from "./helpers.mjs";

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

// Pinned, because the two grades are read off the player's own clock: measuring
// the mood at whatever hour the suite happens to run would make the number below
// drift with the time of day. At noon both grades are zero, so what is measured
// is the palette alone — which is the thing under test.
const NOON = "2026-06-21T12:00:00";

// The scene as a player sees it, inside the letterbox margins. One box for every
// place measured below, or the comparison is between two different questions.
const SCENE = { x: 160, y: 100, width: 960, height: 480 };

const boot = async (page, APP, save) => {
  await page.clock.setFixedTime(new Date(NOON));
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, String(v));
  }, save);
  await page.goto(APP);
  await page.waitForTimeout(1000);
};

const planks = (page) => page.evaluate(() =>
  [...document.querySelectorAll(".way__plank .way__name")].map((t) => t.textContent));

/** Which side of the cleft everyone is on, read out of the world rather than out
 *  of its internals: each walker's centre against the screen position of the
 *  middle of the gorge, via the very matrix the browser painted them with. */
const sides = (page) => page.evaluate(() => {
  const svg = document.querySelector("#valleyBack");
  const p = svg.createSVGPoint();
  // isoX(4.5, 2.5) is the middle of the span; +2 pitches because le pont is
  // frame 2 of the filmstrip and these layers share one coordinate space
  p.x = 468 + (4.5 - 2.5) * 46 + 2 * 728; p.y = 0;
  const mid = p.matrixTransform(svg.getScreenCTM()).x;
  const at = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return "?";
    const r = e.getBoundingClientRect();
    return r.left + r.width / 2 < mid ? "L" : "R";
  };
  return JSON.stringify({
    nuage: at("#sheep"), vif: at("#tok-vif"), reveur: at("#tok-reveur"), ainee: at("#tok-ainee"),
  });
});

const chosen = (page) => page.evaluate(() =>
  [...document.querySelectorAll(".walker.chosen")].map((n) => n.id.replace("tok-", ""))
    .concat(document.querySelector("#stage").classList.contains("chosen") ? ["nuage"] : []).sort().join(","));

const minutes = (page) => page.locator("#bridgeMinutes").innerText();

/** Take the party across: press each walker's number, then walk. */
const walk = async (page, keys) => {
  for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(220); }
  await page.keyboard.press("c");
  await page.waitForTimeout(1500);
};

/** The distance between the happy world and the sad one, in composited pixels,
 *  over whatever is on screen in `box`. Same reader day.spec uses. */
const separation = async (page, box) => {
  const hold = (m) => page.evaluate((v) => {
    document.documentElement.style.setProperty("--m", String(v));
  }, m);
  await hold(0);
  const sad = await patch(page, box);
  await hold(1);
  const happy = await patch(page, box);
  return Math.hypot(...sad.map((c, i) => c - happy[i]));
};

export default async ({ newPage, check, APP }) => {
  /* ---- the door: a way you have not earned is not on the sign ---- */
  let page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, SAVE());
  await page.keyboard.press("j");                 // into la rivière
  await page.waitForTimeout(1500);
  check("an unsolved crossing does not light the bridge",
    !(await planks(page)).includes("le pont"), (await planks(page)).join("|"));
  check("and there is no door for it in the meadow either",
    (await page.locator(".gate, .sprout").count()) === 2,
    "le pont must cost no meadow prop — the signpost is its door");
  await page.close();

  /* ---- solved once, and the way is simply there ---- */
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, SAVE({
    valley: { at: "pre", visited: ["pre"], unlocked: ["riviere", "grange"], solves: { riviere: 1 }, boards: {} },
  }));
  await page.keyboard.press("j");
  await page.waitForTimeout(1500);
  const withPont = await planks(page);
  check("a solved crossing lights the bridge", withPont.includes("le pont"), withPont.join("|"));
  check("and the sign is still in road order", withPont.join("|") === "la grange|le pont|le pré", withPont.join("|"));

  /* ---- walking there ---- */
  const plank = page.locator(".way__plank", { has: page.locator("text=le pont") });
  const pb = await plank.boundingBox();
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.waitForTimeout(3200);
  check("the sign walks him onto the bridge",
    (await page.evaluate(() => document.documentElement.dataset.mode)) === "bridge",
    await page.evaluate(() => document.documentElement.dataset.mode ?? "none"));
  check("and the save knows where he is",
    (await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")).valley.at)) === "pont");
  const bands = await page.evaluate(() =>
    [...document.querySelectorAll("#valleyBack > g, #valleyFront > g")].map((g) => g.id).sort().join(","));
  check("and no other diorama is left in the document", bands === "back-pont,front-pont", bands);

  check("everyone starts on this side", (await sides(page)) === '{"nuage":"L","vif":"L","reveur":"L","ainee":"L"}',
    await sides(page));

  /* ---- two planks' width means two ---- */
  for (const k of ["1", "2", "3"]) { await page.keyboard.press(k); await page.waitForTimeout(240); }
  check("choosing a third swaps the first out rather than doing nothing",
    (await chosen(page)) === "reveur,vif", await chosen(page));
  /* ---- the optimal seventeen ---- */
  // Reset rather than un-picking by hand: walk() presses a walker's number to ADD
  // them, so it can only start from an empty party. Clearing one by pressing it
  // again is how you would remove it, and getting that wrong reads as the app
  // crossing with the wrong pair.
  await page.keyboard.press("r");
  await page.waitForTimeout(500);
  check("a reset clears the board", (await chosen(page)) === "" && (await minutes(page)) === "0 minute",
    `chosen "${await chosen(page)}", ${await minutes(page)}`);

  // the two quick ones over, the quickest back, the slow pair over together,
  // the second-quickest back, the two quick ones over again
  await walk(page, ["1", "2"]);                   // nuage + vif, 2 minutes
  check("the quick pair cross", (await sides(page)) === '{"nuage":"R","vif":"R","reveur":"L","ainee":"L"}',
    await sides(page));
  check("and the minutes add up", (await minutes(page)) === "2 minutes", await minutes(page));

  await walk(page, ["1"]);                        // nuage back, 1
  check("he brings the lantern back", (await sides(page)) === '{"nuage":"L","vif":"R","reveur":"L","ainee":"L"}',
    await sides(page));

  await walk(page, ["3", "4"]);                   // reveur + ainee, 10
  check("the slow pair walk together, once", (await minutes(page)) === "13 minutes", await minutes(page));

  await walk(page, ["2"]);                        // vif back, 2
  await walk(page, ["1", "2"]);                   // nuage + vif, 2
  await page.waitForTimeout(900);

  check("everyone is across", (await sides(page)) === '{"nuage":"R","vif":"R","reveur":"R","ainee":"R"}',
    await sides(page));
  const live = await page.locator("#live").innerText();
  check("in seventeen minutes", live.includes("17 minutes"), live);
  check("and it says that is the minimum", live.includes("minimum"), live);
  check("the solve is remembered",
    (await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")).valley.solves.pont)) === 1);

  /* ---- undo rewinds a crossing, minutes and all ---- */
  await page.locator("#bridgeUndo").click();
  await page.waitForTimeout(600);
  check("undo puts the last pair back", (await sides(page)) === '{"nuage":"L","vif":"L","reveur":"R","ainee":"R"}',
    await sides(page));
  check("and gives the minutes back", (await minutes(page)) === "15 minutes", await minutes(page));

  /* ---- THE check: the dark in here is not a grade ---- */
  const grades = await page.evaluate(() => ({
    dusk: Number(getComputedStyle(document.querySelector(".grade--dusk")).opacity),
    night: Number(getComputedStyle(document.querySelector(".grade--night")).opacity),
  }));
  const bridgeSep = await separation(page, SCENE);
  await page.evaluate(() => document.documentElement.style.removeProperty("--m"));
  await page.close();

  // the same two grades, measured in the meadow at the same hour
  const meadow = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(meadow, APP, SAVE());
  const meadowGrades = await meadow.evaluate(() => ({
    dusk: Number(getComputedStyle(document.querySelector(".grade--dusk")).opacity),
    night: Number(getComputedStyle(document.querySelector(".grade--night")).opacity),
  }));
  check("the bridge lays no new grade over the scene",
    Math.abs(grades.dusk - meadowGrades.dusk) < 0.01 && Math.abs(grades.night - meadowGrades.night) < 0.01,
    `bridge ${JSON.stringify(grades)} vs meadow ${JSON.stringify(meadowGrades)}`);
  await meadow.close();

  // The yardstick is the dimmest place already shipped, not the meadow's sky.
  // Measured at noon over the whole scene: the sky swings 140 levels, la rivière
  // 86, la grange 52, le pont 63. A sky goes from saturated cyan to grey and a
  // barn goes from hay to grey, so they cannot swing alike — holding a ravine to
  // day.spec's 66% OF THE SKY would mean distorting its palette to beat both
  // existing places, which is chasing a number nowhere in this game meets.
  //
  // What actually matters is that a new place is never the thing that kills the
  // mood. So both are measured in the same run and compared to each other, which
  // cannot be unfair and tightens by itself if la grange is ever repainted.
  const barn = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(barn, APP, SAVE({
    valley: { at: "grange", visited: ["pre", "grange"], unlocked: ["riviere", "grange"], solves: { riviere: 1 }, boards: {} },
  }));
  await barn.waitForTimeout(600);
  const barnSep = await separation(barn, SCENE);
  await barn.evaluate(() => document.documentElement.style.removeProperty("--m"));
  await barn.close();

  check("and his mood reads as far in the cleft as anywhere already built",
    bridgeSep > barnSep * 0.9,
    `${bridgeSep.toFixed(1)} in the cleft vs ${barnSep.toFixed(1)} in the barn`);

  /* ---- leaving is always one plank away, even on a solved board ---- */
  const out = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(out, APP, SAVE({
    valley: { at: "pont", visited: ["pre", "pont"], unlocked: ["riviere", "grange", "pont"], solves: { riviere: 1 }, boards: {} },
  }));
  await out.waitForTimeout(900);
  check("a reload puts him back on the bridge",
    (await out.evaluate(() => document.documentElement.dataset.mode)) === "bridge",
    await out.evaluate(() => document.documentElement.dataset.mode ?? "none"));
  check("the way home is never taken away", (await out.locator(".way__plank").count()) >= 1);
  await out.locator(".way__plank").last().click();
  await out.waitForTimeout(900);
  check("and the bridge is left for the meadow",
    (await out.evaluate(() => document.documentElement.dataset.mode)) === undefined);
  await out.close();
};
