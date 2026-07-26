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
  await boot(page, APP, { "nuage:save": '{"v":2,"sheep":{"woolFrom":"not-a-number"},"care":null}' });
  check("a corrupt save still opens onto a meadow", (await page.locator("#sheep").isVisible()));
  check("and he is simply sad, not broken", (await page.locator("#chipState").innerText()) === "Il boude");
  await page.close();

  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, { "nuage:save": "{{{ not json" });
  check("unreadable json opens a fresh meadow", (await page.locator("#sheep").isVisible()));
  await page.close();

  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, { "nuage:save": '{"v":99,"sheep":{"happyUntil":1}}' });
  check("a save from a future build does not half-open", (await page.locator("#chipState").innerText()) === "Il boude");
  await page.close();

  // --- v1 was five loose keys; a returning player keeps everything
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, {
    "nuage:happy-until": Date.now() + 4 * 60 * 1000,
    "nuage:wool-from": Date.now() - 12 * 60 * 1000,
    "nuage:clovers-fed": 5,
    "nuage:unlocked": 1,
    "nuage:crossings": 2,
  });
  check("v1 keeps his happy window", (await page.locator("#chipState").innerText()) === "Heureux");
  check("v1 keeps his fleece", Number((await page.locator("#woolPct").innerText()).replace(/\D/g, "")) >= 78);
  check("v1 keeps the crossing unlocked", (await page.locator(".sprout.open").count()) === 1);
  check("v1 keeps the clovers a win grew", (await page.locator(".clover").count()) === 5);
  const migrated = await page.evaluate(() => ({
    blob: JSON.parse(localStorage.getItem("nuage:save") || "{}"),
    leftovers: ["nuage:happy-until", "nuage:wool-from", "nuage:clovers-fed", "nuage:unlocked", "nuage:crossings"]
      .filter((k) => localStorage.getItem(k) !== null),
  }));
  check("the old keys are cleared away", migrated.leftovers.length === 0, migrated.leftovers.join(","));
  check("and the blob is v2", migrated.blob.v === 2 && migrated.blob.valley.unlocked.includes("riviere"));
  await page.close();
};
