// The day, and the one thing it must not cost.
//
// Every colour in this world is a mix keyed on --m, so the mood is carried by
// the DISTANCE between the happy palette and the sad one. A grade laid over the
// scene multiplies that distance by the same factor it multiplies the palette:
// k·a − k·b = k(a−b). Push it far enough and the mood goes quiet after dark —
// which is exactly when most people will be here, because for half the year
// "after work" is night. So the grade ceilings in rules.js are not a taste
// value, they are whatever keeps this check passing.
import { patch } from "./helpers.mjs";
const MOOD_FLOOR = 0.66;   // measured at 70% with NIGHT_GRADE 0.40, so there is real margin
   // night must keep at least this much of noon's separation

const NOON = "2026-06-21T12:00:00";
const NIGHT = "2026-06-21T02:00:00";
const DUSK = "2026-06-21T21:40:00";

/** The rendered sky, sampled where the grades actually land on it. */
const skyAt = (page, m) => page.evaluate((mood) => {
  document.documentElement.style.setProperty("--m", String(mood));
  const px = getComputedStyle(document.querySelector(".sky")).backgroundImage;
  const grade = (sel) => {
    const e = document.querySelector(sel);
    return e ? Number(getComputedStyle(e).opacity) : 0;
  };
  return { px, night: grade(".grade--night"), dusk: grade(".grade--dusk") };
}, m);

/** How far apart the happy world and the sad one look, in composited pixels.
 *  Modelling this instead — "multiply at opacity a leaves 1-a of the
 *  difference" — assumes the grade is black and ignores every layer above it,
 *  and gets a materially different answer. So it is read off the screen. */
const separation = async (page) => {
  const box = { x: 40, y: 30, width: 220, height: 140 };   // open sky, above the hills
  const hold = (m) => page.evaluate((v) => {
    // pin --m so the frame loop cannot move it under the shutter
    const root = document.documentElement;
    root.style.setProperty("--m", String(v));
    root.dataset.pin = "1";
  }, m);
  await hold(0);
  const sad = await patch(page, box);
  await hold(1);
  const happy = await patch(page, box);
  await page.evaluate(() => { delete document.documentElement.dataset.pin; });
  return Math.hypot(...sad.map((c, i) => c - happy[i]));
};

export default async ({ newPage, check, APP }) => {
  const at = async (iso) => {
    const page = await newPage({ viewport: { width: 1280, height: 800 } });
    await page.clock.setFixedTime(new Date(iso));
    await page.goto(APP);
    await page.waitForTimeout(900);
    return page;
  };

  // --- noon is the meadow exactly as it shipped: both grades at zero
  const noon = await at(NOON);
  const lit = await skyAt(noon, 0);
  check("at noon the day costs nothing", lit.night === 0 && lit.dusk === 0,
    `night=${lit.night} dusk=${lit.dusk}`);
  const noonSep = await separation(noon);
  check("and the sky still swings on his mood", noonSep > 25, `${noonSep.toFixed(1)} levels apart`);
  await noon.close();

  // --- the sun sets rather than fading, and the moon takes its place
  const dusk = await at(DUSK);
  const evening = await page_positions(dusk);
  check("at dusk the sun is low and west", evening.sunTop > 0.3 && evening.arc > 0.8,
    JSON.stringify(evening));
  await dusk.close();

  const night = await at(NIGHT);
  const dark = await skyAt(night, 0);
  check("at 2am the night grade is up", dark.night > 0.3, `night=${dark.night}`);

  // THE check: the mood must survive the dark
  const nightSep = await separation(night);
  const kept = nightSep / noonSep;
  check("and his mood still reads after dark", kept >= MOOD_FLOOR,
    `${(kept * 100).toFixed(0)}% of noon's separation kept, floor is ${MOOD_FLOOR * 100}%`);

  // --- nothing is gated by the hour: every verb works at 3am
  check("the clovers are still there at 2am", (await night.locator(".clover").count()) >= 3);
  check("and the shears are still in the grass", (await night.locator(".shears").count()) === 1);
  const box = await night.locator("#sheep").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height * 0.62;
  await night.mouse.move(cx, cy);
  await night.mouse.down();
  for (const i of [...Array(46).keys()]) {
    await night.mouse.move(cx + Math.sin(i / 2.4) * box.width * 0.14, cy + Math.cos(i / 3) * 30, { steps: 3 });
    await night.waitForTimeout(14);
  }
  await night.mouse.up();
  await night.waitForTimeout(500);
  check("and he can be made happy in the dark", (await night.locator("#chipState").innerText()) === "Heureux",
    await night.locator("#chipState").innerText());
  await night.close();

  await pelote({ newPage, check, APP });
};

const page_positions = (page) => page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const sun = document.querySelector(".sun").getBoundingClientRect();
  return {
    arc: Number(cs.getPropertyValue("--arc")),
    day: Number(cs.getPropertyValue("--day")),
    sunTop: sun.top / innerHeight,
    moon: Number(getComputedStyle(document.querySelector(".moon")).opacity),
  };
});

/* ---- la pelote: the one thing he plays with, on no clock at all -------- */
export const pelote = async ({ newPage, check, APP }) => {
  const shorn = {
    v: 4, sheep: { happyUntil: 0, woolFrom: Date.now() - 60000 }, care: { fed: 0, shorn: 1 },
    valley: { at: "pre", visited: ["pre"], unlocked: [], solves: {}, boards: {} },
    prefs: { sound: false },
  };
  const fresh = { ...shorn, care: { fed: 0, shorn: 0 } };

  let page = await newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript((s) => localStorage.setItem("nuage:save", s), JSON.stringify(fresh));
  await page.goto(APP);
  await page.waitForTimeout(800);
  check("before a shearing there is no ball of wool",
    await page.locator(".pelote").evaluate((n) => getComputedStyle(n).display === "none"));
  await page.close();

  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript((s) => localStorage.setItem("nuage:save", s), JSON.stringify(shorn));
  await page.goto(APP);
  await page.waitForTimeout(800);
  check("a fleece taken off leaves one in the grass",
    await page.locator(".pelote").evaluate((n) => getComputedStyle(n).display !== "none"));

  const where = async () => (await page.locator(".pelote").boundingBox()).x;
  const before = await where();
  const box = await page.locator(".pelote").boundingBox();
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.6);
  await page.waitForTimeout(700);
  const after = await where();
  check("pushing it sets it rolling", Math.abs(after - before) > 40, `${before} -> ${after}`);

  // it must come to rest, and it must never leave the meadow
  await page.waitForTimeout(2200);
  const rest = await where();
  await page.waitForTimeout(700);
  check("and it rolls to a stop", Math.abs((await where()) - rest) < 3);
  check("without ever leaving the meadow", rest > -20 && rest < 1280, `${rest}`);

  // it costs nothing and buys nothing: playing is not a clock
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")));
  check("playing with it changes no clock", saved.care.shorn === 1 && saved.sheep.happyUntil === 0,
    JSON.stringify(saved.care));
  check("and it never made him happy on its own",
    (await page.locator("#chipState").innerText()) === "Il boude");
  await page.close();
};
