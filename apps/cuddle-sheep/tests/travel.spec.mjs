// Walking the valley: the road between two places, what is in the document
// while he is on it, and the thing the whole design turns on — that he crosses
// ground on screen instead of riding a camera that keeps him centred.
const VALLEY = {
  v: 3, sheep: { happyUntil: 0, woolFrom: 0 },
  care: { fed: 5, shorn: 3 },
  valley: { at: "pre", visited: ["pre"], unlocked: ["riviere", "grange"], solves: {} },
  prefs: { sound: false },
};

/** Seed only a first load, so a reload reads back what the app itself wrote. */
const seed = async (page, blob) => {
  await page.addInitScript((s) => {
    if (!localStorage.getItem("nuage:save")) localStorage.setItem("nuage:save", s);
  }, JSON.stringify(blob));
};

export default async ({ newPage, check, APP }) => {
  const page = await newPage({ viewport: { width: 1280, height: 800 } });
  const mode = () => page.evaluate(() => document.documentElement.dataset.mode ?? "none");
  // the one he is in plus its open neighbours, inert, so the valley reads as
  // continuous — anything further than one step must still be out of the document
  const bands = () => page.evaluate(() =>
    [...new Set([...document.querySelectorAll("#valleyBack > g[data-layer], #valleyFront > g[data-layer]")]
      .map((g) => g.id.replace(/^(back|front)-/, "")))].sort().join(","));
  // The way out is a border now, so a walk has a DIRECTION rather than a position in
  // a list. The signpost's first plank happened to be the way onward from the river
  // and the way back from the barn; an edge has to be asked for by name.
  const walk = async (dir) => {
    const b = await page.locator(`g[data-layer]:not([inert]) .edge[data-dir="${dir}"]`).boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };
  // Scoped to the band he is actually IN. The neighbours are in the document now, so a
// bare .edge__name query returns their ways out as well as his — and `:not([inert])`
// is exactly the distinction, since a place you are only looking at is inert.
  const wayNames = (p) => p.evaluate(() =>
    [...document.querySelectorAll("g[data-layer]:not([inert]) .edge__name")].map((t) => t.textContent));

  await seed(page, VALLEY);
  await page.goto(APP);
  await page.waitForTimeout(1000);
  await page.keyboard.press("j");
  await page.waitForTimeout(1600);
  check("the river and what is next to it are in the document", (await bands()) === "grange,riviere", await bands());

  // A sleeping place must be OUT of the document, not merely hidden: an <svg>
  // clips to its CSS box and not its viewBox, so on a wide viewport the
  // letterbox margins would simply show the barn from the river.
  check("the borders name where he can go", (await wayNames(page)).join("|") === "la grange|le pré",
    (await wayNames(page)).join("|"));

  // sample his position on screen for the length of the walk
  const samples = [];
  await walk(1);                             // east, to the barn
  for (const i of [...Array(22).keys()]) {
    samples.push(await page.evaluate(() => Math.round(document.querySelector("#sheep").getBoundingClientRect().x)));
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(1500);

  check("he arrives at the barn", (await mode()) === "barn", await mode());
  check("and the river stays as the neighbour he came from", (await bands()) === "grange,riviere", await bands());

  // The destination must be squarely in frame on arrival. It is not enough for
  // the camera to have "followed him": two doorways are far closer together
  // than the frames they stand in are wide, so a camera derived from his
  // POSITION runs out of travel and leaves the barn hundreds of units off
  // centre. This is the check that says the camera comes off trip progress.
  const camera = await page.evaluate(() =>
    Number(document.querySelector("#valleyBack").getAttribute("viewBox").split(" ")[0]));
  check("and the barn is squarely in frame", Math.abs(camera - 924) < 2, `viewBox x = ${camera}, want 924`);

  // The camera is derived from him with a dead band rather than driven at the
  // destination: two independent springs would pin him near the centre of the
  // frame and only his legs would move.
  const span = Math.max(...samples) - Math.min(...samples);
  const moving = samples.filter((x, i) => i && Math.abs(x - samples[i - 1]) > 1).length;
  check("he crosses ground on screen rather than riding", span > 120, `${span}px of travel across the frame`);
  check("and he is moving for most of the walk", moving > samples.length * 0.4, `${moving}/${samples.length} frames`);

  /* ---- and the way back is measured, because both ends of it used to teleport ---- */
  // He was dropped onto the departure threshold the instant a trip began and lifted
  // off the arrival one the instant it ended: 258px and 159px of jump, with a
  // beautifully rendered crossing in between. The walk is three legs now — where he
  // stands, to the threshold, across, to where he will stand — so both ends are
  // continuous. The return journey doubles as the measurement rather than adding a
  // third trip: from the barn the way on is WEST.
  //
  // Compared by SHAPE, not by distance. "Moved less than 60px in 130ms" is a speed
  // assertion dressed as a continuity one — CI runs slower, covers more ground in the
  // same wall clock, and failed at 72px on a walk that was perfectly continuous. What
  // actually separates a teleport from a walk is that he accelerates from REST, so his
  // first step is among the smallest; a teleport makes it the largest by an order of
  // magnitude. That holds on any machine at any frame rate.
  const at = () => page.evaluate(() => {
    const r = document.querySelector("#sheep").getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2,
      mode: document.documentElement.dataset.mode ?? "none" };
  });
  const path = [await at()];
  await walk(-1);
  for (const i of [...Array(30).keys()]) {
    await page.waitForTimeout(80);
    path.push(await at());
    if (path.length > 6 && path.at(-1).mode !== path.at(-2).mode) break;
  }
  const steps = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y));
  const median = [...steps].sort((a, b) => a - b)[Math.floor(steps.length / 2)];
  const acrossArrival = path.at(-1).mode !== path.at(-2).mode ? steps.at(-1) : 0;

  check("setting off does not teleport him onto the threshold",
    steps[0] <= median, `first step ${Math.round(steps[0])}px against a median of ${Math.round(median)}px`);
  check("and arriving does not teleport him off it",
    acrossArrival > 0 && acrossArrival <= median * 1.5,
    `${Math.round(acrossArrival)}px across the change of place, median step ${Math.round(median)}px`);
  await page.waitForTimeout(1800);

  check("the road runs both ways", (await mode()) === "cross", await mode());

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")).valley);
  check("the save knows where he is", saved.at === "riviere", JSON.stringify(saved));
  check("and everywhere he has been", ["pre", "riviere", "grange"].every((p) => saved.visited.includes(p)),
    JSON.stringify(saved.visited));

  await page.reload();
  await page.waitForTimeout(1800);
  check("a reload leaves him where he was standing", (await mode()) === "cross", await mode());

  // --- a thumb dragged across the sky walks him; one dragged across his back
  // is a cuddle and must never be mistaken for one
  //
  // A swipe has a DEADLINE — hands.js rejects a gesture held longer than 0.6s,
  // because a slow drag is somebody pointing rather than somebody swiping. So
  // this must be one continuous motion: an earlier version stepped eight times
  // with a waitForTimeout between each, which cost 0.9s of round trips and was
  // rejected by the app on every run. It read as an app bug and was a test that
  // could not make the gesture it was testing. Do not put a sleep in here.
  const drag = async (from, to, y) => {
    await page.mouse.move(from, y);
    await page.mouse.down();
    await page.mouse.move(to, y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(2800);
  };
  await drag(900, 640, 150);                 // across the sky, right to left
  check("a swipe walks him east", (await mode()) === "barn", await mode());
  // Start clear of him: at 1280x800 his box reaches x=592, and a drag that BEGINS
  // on his back is a cuddle by design — so starting one there and then asserting
  // "he did not move" passes whether travel works or not. Both directions have to
  // be real journeys, or the pair proves nothing.
  await drag(700, 1000, 150);                // and back, east to west
  check("and the other way walks him west", (await mode()) === "cross", await mode());

  // ...which is what makes this check mean something: the same gesture, the same
  // speed, the same distance — moved onto his back, and now it must NOT travel.
  const sheepBox = await page.locator("#sheep").boundingBox();
  const cy = sheepBox.y + sheepBox.height * 0.62;
  await drag(sheepBox.x + sheepBox.width * 0.25, sheepBox.x + sheepBox.width * 0.75, cy);
  check("a stroke across his back is never a swipe", (await mode()) === "cross", await mode());
  await page.close();

  // --- a place he has not opened has no road to it
  const shut = await newPage({ viewport: { width: 1280, height: 800 } });
  await seed(shut, { ...VALLEY, care: { fed: 5, shorn: 0 }, valley: { ...VALLEY.valley, unlocked: ["riviere"] } });
  await shut.goto(APP);
  await shut.waitForTimeout(1000);
  await shut.keyboard.press("j");
  await shut.waitForTimeout(1500);
  const shutWays = await wayNames(shut);
  check("a way you have not earned has no border", shutWays.join("|") === "le pré", shutWays.join("|"));
  check("and the barn gate is not in the meadow either",
    await shut.locator(".gate").evaluate((n) => getComputedStyle(n).display === "none"));
  await shut.close();

  /* ---- the crossing: fleece over a change of place, never over a walk ---- */
  // This is the one that matters. The whole design of travel is that HE crosses
  // ground and you watch him do it — so a curtain over that would hide the thing
  // it took a camera derived from trip progress to make watchable in the first
  // place. Covering the meadow↔place step is welcome; covering a walk is not.
  const swept = async (p, samples, gap = 65) => {
    let seen = false;
    for (const i of [...Array(samples).keys()]) {
      if (await p.evaluate(() => document.querySelector(".puffs")?.classList.contains("crossing"))) seen = true;
      await p.waitForTimeout(gap);
    }
    return seen;
  };

  const cross = await newPage({ viewport: { width: 1280, height: 800 } });
  await seed(cross, { ...VALLEY, valley: { ...VALLEY.valley, at: "riviere", visited: ["pre", "riviere"] } });
  await cross.goto(APP);
  await cross.waitForTimeout(1700);
  check("the fleece curtain is built", (await cross.locator(".puff").count()) > 0);
  check("and he is at the river to start", (await mode2(cross)) === "cross", await mode2(cross));

  const b = await cross.locator('g[data-layer]:not([inert]) .edge[data-dir="1"]').boundingBox();
  await cross.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  const duringWalk = await swept(cross, 45, 70);
  check("walking the valley is never curtained", !duringWalk,
    "you are meant to watch him cross the ground");
  check("and the walk still arrives", (await mode2(cross)) === "barn", await mode2(cross));

  await cross.keyboard.press("Escape");
  check("but leaving for the meadow is", await swept(cross, 14));
  await cross.waitForTimeout(1200);
  check("and the curtain clears itself afterwards",
    await cross.evaluate(() => getComputedStyle(document.querySelector(".puffs")).visibility === "hidden"));
  await cross.close();

  // motion is delight here, not information: with it turned down there is no
  // curtain at all rather than a still one, and everything still works
  const calm = await newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await seed(calm, VALLEY);
  await calm.goto(APP);
  await calm.waitForTimeout(1000);
  check("reduced motion builds no curtain at all", (await calm.locator(".puffs").count()) === 0);
  await calm.keyboard.press("j");
  await calm.waitForTimeout(1500);
  check("and you still get where you are going", (await mode2(calm)) === "cross", await mode2(calm));
  await calm.close();
};

const mode2 = (p) => p.evaluate(() => document.documentElement.dataset.mode ?? "none");
