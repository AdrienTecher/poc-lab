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
  const bands = () => page.evaluate(() =>
    [...document.querySelectorAll("#valleyBack > g, #valleyFront > g")].map((g) => g.id).sort().join(","));
  const walkTo = async () => {
    const way = await page.locator(".way").first().boundingBox();
    await page.mouse.click(way.x + way.width / 2, way.y + way.height * 0.62);
  };

  await seed(page, VALLEY);
  await page.goto(APP);
  await page.waitForTimeout(1000);
  await page.keyboard.press("j");
  await page.waitForTimeout(1600);
  check("the river is the only diorama in the document", (await bands()) === "back-riviere,front-riviere", await bands());

  // A sleeping place must be OUT of the document, not merely hidden: an <svg>
  // clips to its CSS box and not its viewBox, so on a wide viewport the
  // letterbox margins would simply show the barn from the river.
  check("the road east is drawn", (await page.locator(".way").count()) === 1);

  // sample his position on screen for the length of the walk
  const samples = [];
  await walkTo();
  for (const i of [...Array(22).keys()]) {
    samples.push(await page.evaluate(() => Math.round(document.querySelector("#sheep").getBoundingClientRect().x)));
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(1500);

  check("he arrives at the barn", (await mode()) === "barn", await mode());
  check("and the river goes dark behind him", (await bands()) === "back-grange,front-grange", await bands());

  // The camera is derived from him with a dead band rather than driven at the
  // destination: two independent springs would pin him near the centre of the
  // frame and only his legs would move.
  const span = Math.max(...samples) - Math.min(...samples);
  const moving = samples.filter((x, i) => i && Math.abs(x - samples[i - 1]) > 1).length;
  check("he crosses ground on screen rather than riding", span > 120, `${span}px of travel across the frame`);
  check("and he is moving for most of the walk", moving > samples.length * 0.4, `${moving}/${samples.length} frames`);

  // --- and back again, because a road only ever opens
  await walkTo();
  await page.waitForTimeout(3000);
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
  const drag = async (from, to, y) => {
    await page.mouse.move(from, y);
    await page.mouse.down();
    for (const i of [...Array(8).keys()]) {
      await page.mouse.move(from + (to - from) * ((i + 1) / 8), y, { steps: 2 });
      await page.waitForTimeout(12);
    }
    await page.mouse.up();
    await page.waitForTimeout(2600);
  };
  await drag(900, 640, 150);                 // across the sky, right to left
  check("a swipe walks him east", (await mode()) === "barn", await mode());
  await drag(500, 800, 150);                 // and back
  check("and the other way walks him west", (await mode()) === "cross", await mode());

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
  const shown = await shut.evaluate(() =>
    [...document.querySelectorAll(".way")].filter((w) => getComputedStyle(w).display !== "none").length);
  check("a way you have not earned is not drawn at all", shown === 0, `${shown} visible`);
  check("and the barn gate is not in the meadow either",
    await shut.locator(".gate").evaluate((n) => getComputedStyle(n).display === "none"));
  await shut.close();
};
