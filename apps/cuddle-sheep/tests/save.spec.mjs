// The clocks are the game: they must survive a reload, and a broken save must
// never greet the player with a broken world.
import { boot, cuddle } from "./helpers.mjs";

export default async ({ newPage, check, APP }) => {
  let page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP);
  await cuddle(page);
  await page.reload();
  await page.waitForTimeout(1200);
  check("the happy window survives a reload", (await page.locator("#chipState").innerText()) === "Heureux");

  // the fleece is a wall-clock: it must never rewind, and it keeps ticking
  // through the reload itself, so the invariant is "forward, by a little"
  const pct = async () => Number((await page.locator("#woolPct").innerText()).replace(/\D/g, ""));
  const before = await pct();
  await page.reload();
  await page.waitForTimeout(1000);
  const after = await pct();
  check("the fleece never rewinds across a reload", after >= before, `${before}% -> ${after}%`);
  check("and it does not jump", after - before <= 4, `${before}% -> ${after}%`);
  await page.close();

  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, { "nuage:wool-from": "not-a-number", "nuage:happy-until": "{}" });
  check("a corrupt save still opens onto a meadow", (await page.locator("#sheep").isVisible()));
  check("and he is simply sad, not broken", (await page.locator("#chipState").innerText()) === "Il boude");
  await page.close();
};
