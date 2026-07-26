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

  // A cuddle buys exactly five minutes and a reload must not top it up: read the
  // countdown, reload, and require it to have gone DOWN. Measured against a fresh
  // boot this would pass on a save that hands out a new window every time.
  const secondsLeft = async () => {
    const [, m, sec] = (await page.locator("#chipTime").innerText()).match(/(\d+):(\d+)/) ?? [];
    return Number(m) * 60 + Number(sec);
  };
  const leftBefore = await secondsLeft();
  await page.reload();
  await page.waitForTimeout(1200);
  const leftAfter = await secondsLeft();
  check("a reload never hands out more happiness", leftAfter < leftBefore, `${leftBefore}s -> ${leftAfter}s`);
  check("and it does not lose the window either", leftAfter > leftBefore - 20, `${leftBefore}s -> ${leftAfter}s`);
  await page.close();

  // The fleece is a wall-clock. Start it somewhere a non-persisting boot could
  // never produce (a fresh save always reads 45%), so "it survived" is provable.
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, {
    "nuage:save": JSON.stringify({ v: 2, sheep: { happyUntil: 0, woolFrom: Date.now() - 12 * 60 * 1000 } }),
  });
  const pct = async () => Number((await page.locator("#woolPct").innerText()).replace(/\D/g, ""));
  const before = await pct();
  check("a stored fleece is read back, not defaulted", before >= 78 && before <= 82, `${before}%`);
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

  // a fixture that would visibly differ if the version gate were dropped: without
  // it, graft() would read this window and he would open the page already happy
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, {
    "nuage:save": JSON.stringify({ v: 99, sheep: { happyUntil: Date.now() + 4 * 60 * 1000 } }),
  });
  check("a save from a future build is not half-read", (await page.locator("#chipState").innerText()) === "Il boude");
  await page.close();

  // --- the v2 read path, which every other fixture skips by going through v1
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, {
    "nuage:save": JSON.stringify({
      v: 2,
      sheep: { happyUntil: 0, woolFrom: Date.now() - 3 * 60 * 1000 },
      care: { fed: 5 },
      valley: { unlocked: ["riviere"], solves: { riviere: 1 } },
      prefs: { sound: false },
    }),
  });
  check("v2 carries the unlock", (await page.locator(".sprout.open").count()) === 1);
  check("v2 carries the reward clovers", (await page.locator(".clover").count()) === 4);
  check("v2 carries the mute, and the button says so",
    (await page.locator("#sound").getAttribute("aria-pressed")) === "false");
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
