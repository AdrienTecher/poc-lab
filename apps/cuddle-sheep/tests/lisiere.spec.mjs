import { liveBands, peeking } from "./helpers.mjs";
// La lisière: gather three hens where the dog can watch them, and le chien — the
// second animal, who is also the piece that makes the place solvable.
//
// The fox is checked too, and what is checked about him is that he does NOTHING.
// He is drawn because dusk at a wood's edge without one would be a lie about where
// you are; the moment he can take a hen this stops being a place where nothing can
// be lost, which is the rule the whole valley keeps.
import { BOXES, HENS, SPAN, SPOTS, solved, fewest, start, sorted } from "../src/puzzles/lisiere.js";

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

const OPEN = (at) => ({
  at, visited: ["pre", at],
  unlocked: ["riviere", "grange", "pont", "clocher", "cloture", "lisiere"],
  solves: { clocher: 1 }, boards: {},
});

const boot = async (page, APP, save) => {
  await page.clock.setFixedTime(new Date(NOON));
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, String(v));
  }, save);
  await page.goto(APP);
  await page.waitForTimeout(1000);
};

/** The board, read out of the world: which box each hen's centre is nearest, and
 *  which boxes the dog is watching, by the classes the renderer actually wrote. */
const board = (page) => page.evaluate(() => {
  const boxes = [...document.querySelectorAll(".nest")].map((n) => {
    const r = n.getBoundingClientRect();
    return r.left + r.width / 2;
  });
  const nearest = (el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    let best = 0;
    for (const [i, bx] of boxes.entries()) if (Math.abs(bx - x) < Math.abs(boxes[best] - x)) best = i;
    return best;
  };
  return {
    hens: [...document.querySelectorAll(".hen")].map(nearest).sort((a, b) => a - b),
    watched: [...document.querySelectorAll(".nest")]
      .map((n, i) => (n.classList.contains("watched") ? i : null)).filter((v) => v !== null),
    safe: document.querySelectorAll(".hen.safe").length,
  };
});

const moves = (page) => page.locator("#edgeMoves").innerText();

export default async ({ newPage, check, APP }) => {
  /* ---- the rules, before any world ---- */
  // fewest() is a closed form, so it is checked against every board there is
  let broken = 0, alreadyDone = 0;
  for (let a = 0; a < BOXES; a++) for (let b = a + 1; b < BOXES; b++) for (let c = b + 1; c < BOXES; c++) {
    for (let d = 0; d < SPOTS; d++) {
      const f = fewest([a, b, c], d);
      if (!Number.isFinite(f)) broken++;
      // the answer must be zero exactly when the board is already gathered
      if ((f === 0) !== solved([a, b, c], d)) broken++;
    }
  }
  check("every wood's edge there is can be gathered", broken === 0, `${broken} bad boards`);
  for (const k of [...Array(300).keys()]) {
    const s = start(Math.random);
    if (solved(s.hens, s.dog)) alreadyDone++;
    if (new Set(s.hens).size !== HENS) broken++;
  }
  check("and a new one is never already gathered", alreadyDone === 0 && broken === 0, `${alreadyDone} of 300`);

  /* ---- le chien in the meadow: the second animal, on no clock at all ---- */
  let page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, SAVE());
  check("before anything is finished together there is no dog",
    await page.locator(".chien").evaluate((n) => getComputedStyle(n).display === "none"));
  await page.close();

  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, SAVE({
    valley: { at: "pre", visited: ["pre"], unlocked: ["riviere"], solves: { riviere: 1 }, boards: {} },
  }));
  check("finishing something brings him to the meadow",
    await page.locator(".chien").evaluate((n) => getComputedStyle(n).display !== "none"));
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")));
  const dogBox = await page.locator(".chien").boundingBox();
  await page.mouse.click(dogBox.x + dogBox.width / 2, dogBox.y + dogBox.height * 0.6);
  await page.waitForTimeout(700);
  check("petting him wags his tail", (await page.locator(".chien.wagging").count()) === 1);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")));
  // THE rule about him: happiness is the sheep's clock and the only one that may
  // empty, so a second animal must not arrive with a second thing to keep topped up
  check("but he is on no clock — petting him changes nothing",
    JSON.stringify(before.sheep) === JSON.stringify(after.sheep)
    && JSON.stringify(before.care) === JSON.stringify(after.care),
    `${JSON.stringify(after.sheep)} ${JSON.stringify(after.care)}`);
  check("and he never made the sheep happy on his own",
    (await page.locator("#chipState").innerText()) === "Il boude",
    await page.locator("#chipState").innerText());
  await page.close();

  /* ---- the wood's edge ---- */
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, SAVE({ valley: OPEN("lisiere") }));
  await page.waitForTimeout(700);
  check("a reload puts him back at the wood's edge",
    (await page.evaluate(() => document.documentElement.dataset.mode)) === "edge",
    await page.evaluate(() => document.documentElement.dataset.mode ?? "none"));
  const bands = await page.evaluate(() =>
    [...document.querySelectorAll("#valleyBack > g, #valleyFront > g")].map((g) => g.id).sort().join(","));
  // Invariant 9 changed shape: a sleeping place still leaves the document, but the
  // two open NEIGHBOURS stay, inert, so the valley reads as continuous in the
  // letterbox margins. What must still be gone is anything further than one step.
  check("its neighbours are here too, and nothing further",
    (await liveBands(page)).join(",") === "cloture,lisiere", (await liveBands(page)).join(","));
  check("and they are only being looked at",
    (await peeking(page)).join(",") === "cloture", (await peeking(page)).join(","));
  check("there are eight boxes and three hens",
    (await page.locator(".nest").count()) === BOXES && (await page.locator(".hen").count()) === HENS);
  check("and it is the same dog as the one in the grass",
    (await page.locator(".watchdog .chien__tail").count()) === 1,
    "la lisière draws him from world/chien.js, so there is only ever one animal");

  const opening = await board(page);
  check("the dog watches three boxes in a row", opening.watched.length === SPAN
    && opening.watched.every((v, i) => v === opening.watched[0] + i), JSON.stringify(opening.watched));
  check("and the flock does not start gathered", opening.safe < HENS, JSON.stringify(opening));

  /* ---- a hen flies to a free box, and it costs the distance ---- */
  await page.locator(".hen").first().dispatchEvent("pointerdown");
  await page.waitForTimeout(300);
  check("tapping a hen chooses her", (await page.locator(".hen.chosen").count()) === 1);
  const free = [...Array(BOXES).keys()].find((i) => !opening.hens.includes(i));
  const from = opening.hens[0];
  await page.locator(`#box-${free}`).dispatchEvent("pointerdown");
  await page.waitForTimeout(400);
  const flown = await board(page);
  check("and she flies to a free box", flown.hens.includes(free), JSON.stringify(flown.hens));
  check("for a box per beat of wing", (await moves(page)) === `${Math.abs(free - from)} pas`, await moves(page));

  /* ---- a taken box is a sentence, never a loss ---- */
  await page.locator(".hen").first().dispatchEvent("pointerdown");
  await page.waitForTimeout(250);
  const taken = flown.hens.find((h) => h !== flown.hens[0]) ?? flown.hens[1];
  await page.locator(`#box-${taken}`).dispatchEvent("pointerdown");
  await page.waitForTimeout(350);
  check("a box that is taken is refused kindly",
    (await page.locator("#live").innerText()).includes("occupe cette case"),
    await page.locator("#live").innerText());
  check("and nothing is lost by trying",
    JSON.stringify((await board(page)).hens) === JSON.stringify(flown.hens),
    JSON.stringify((await board(page)).hens));

  /* ---- undo, then gather them properly ---- */
  await page.locator("#edgeUndo").click();
  await page.waitForTimeout(400);
  check("undo puts her back", JSON.stringify((await board(page)).hens) === JSON.stringify(opening.hens),
    JSON.stringify((await board(page)).hens));
  check("and gives the steps back", (await moves(page)) === "0 pas", await moves(page));

  /* ---- solve it by following what the rules say is cheapest ---- */
  const live = await board(page);
  const dogAt = live.watched[0];
  // the cheapest span, worked out the same way fewest() does
  let bestSpot = dogAt, bestCost = Infinity;
  for (const s of [...Array(SPOTS).keys()]) {
    const c = Math.abs(s - dogAt) + sorted(live.hens).reduce((sum, at, i) => sum + Math.abs(at - (s + i)), 0);
    if (c < bestCost) { bestCost = c; bestSpot = s; }
  }
  // move the dog first if he has to move, then each hen onto her target box
  if (bestSpot !== dogAt) {
    await page.locator(".watchdog").dispatchEvent("pointerdown");
    await page.waitForTimeout(250);
    await page.locator(`#box-${bestSpot}`).dispatchEvent("pointerdown");
    await page.waitForTimeout(400);
  }
  // Targets are assigned sorted-to-sorted, and a hen is moved only once — but an
  // earlier hen may be sitting on a later hen's target, so the ones already right
  // are left alone and the rest go in an order that never lands on an occupied box.
  const targets = [...Array(SPAN).keys()].map((i) => bestSpot + i);
  for (const t of targets) {
    let now = await board(page);
    if (now.hens.includes(t)) continue;
    // the hen furthest outside the span goes next
    const outside = now.hens.filter((h) => h < bestSpot || h >= bestSpot + SPAN);
    const pick = outside[0];
    const idx = await page.evaluate(([want]) => {
      const boxes = [...document.querySelectorAll(".nest")].map((n) => {
        const r = n.getBoundingClientRect();
        return r.left + r.width / 2;
      });
      const hens = [...document.querySelectorAll(".hen")];
      for (const [i, h] of hens.entries()) {
        const r = h.getBoundingClientRect();
        const x = r.left + r.width / 2;
        let best = 0;
        for (const [k, bx] of boxes.entries()) if (Math.abs(bx - x) < Math.abs(boxes[best] - x)) best = k;
        if (best === want) return i;
      }
      return -1;
    }, [pick]);
    if (idx < 0) break;
    await page.locator(".hen").nth(idx).dispatchEvent("pointerdown");
    await page.waitForTimeout(250);
    await page.locator(`#box-${t}`).dispatchEvent("pointerdown");
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  const done = await board(page);
  check("gathering them puts every hen where the dog can see her", done.safe === HENS,
    JSON.stringify(done));
  const said = await page.locator("#live").innerText();
  check("and the wood's edge says so", said.includes("sous la garde du chien"), said);
  check("in the fewest steps", said.includes("minimum"), said);
  check("the solve is remembered",
    (await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")).valley.solves.lisiere)) === 1);

  /* ---- the fox does nothing, and that is the point of him ---- */
  check("the fox is scenery, not a piece",
    (await page.locator(".fox").count()) === 1
    && (await page.locator(".fox").evaluate((n) => n.getAttribute("aria-hidden") === "true"
      && !n.hasAttribute("tabindex"))),
    "a fox that could take a hen would make this the one place where something is lost");

  /* ---- the ways out at the end of the road, and both of them reachable ---- */
  // This is the last place on the road, so there is nowhere further east: the ways
  // out are back the way he came and home, and no more. Which is the point of the
  // edges over the signpost — a sign grew a plank per place and ran off the bottom
  // of the frame at six, while a border has room for exactly as many directions as
  // it has. What is checked is reachability, not appearance: a marker drawn outside
  // the frame keeps its click target, because overflow:hidden hides it without
  // unhitting it, and that is how the way home once ended up under a control bar.
  const ways = await page.evaluate(() => {
    const layer = document.querySelector("#valleyFront").getBoundingClientRect();
    return [...document.querySelectorAll("g[data-layer]:not([inert]) .edge")].map((p) => {
      const r = p.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      return {
        dir: p.dataset.dir,
        name: p.nextElementSibling?.textContent,
        inside: cy > layer.top && cy < layer.bottom && cx > layer.left && cx < layer.right,
        // and whatever is actually under the middle of it must be the marker itself
        hits: document.elementFromPoint(cx, cy)?.closest(".edge") !== null,
      };
    });
  });
  check("the last place on the road has a way back and a way home, and no way on",
    ways.map((w) => w.dir).sort().join(",") === "-1,0",
    ways.map((w) => `${w.dir}:${w.name}`).join(" | "));
  check("the way back names the place before it", ways.find((w) => w.dir === "-1")?.name === "la clôture",
    ways.map((w) => `${w.dir}:${w.name}`).join(" | "));
  check("every way out is inside the frame", ways.every((w) => w.inside),
    ways.filter((w) => !w.inside).map((w) => w.name).join("|") || "none outside");
  check("and every way out is what you actually hit when you tap it",
    ways.every((w) => w.hits),
    ways.filter((w) => !w.hits).map((w) => w.name).join("|") || "all reachable");

  /* ---- leaving is always one border away, even on a solved board ---- */
  check("the way home is never taken away", (await page.locator('g[data-layer]:not([inert]) .edge[data-dir="0"]').count()) === 1);
  await page.locator('g[data-layer]:not([inert]) .edge[data-dir="0"]').click();
  await page.waitForTimeout(900);
  check("and the wood's edge is left for the meadow",
    (await page.evaluate(() => document.documentElement.dataset.mode)) === undefined);
  await page.close();
};
