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

  // A clock that moved BACKWARDS under a stored epoch. Nothing here can buy more
  // than five minutes, so a window ending in a month is not a long cuddle — it is a
  // timezone change or an NTP correction, and the readout used to print it
  // faithfully as "50849:39 restantes". The number is clamped on the way out and
  // the stored epoch healed, so the lie does not survive in the save either.
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, {
    "nuage:save": JSON.stringify({
      v: 4, sheep: { happyUntil: Date.now() + 30 * 24 * 3600 * 1000, woolFrom: Date.now() - 60000 },
      care: { fed: 0, shorn: 0 }, valley: { at: "pre", visited: ["pre"], unlocked: [], solves: {}, boards: {} },
      prefs: { sound: false },
    }),
  });
  const absurd = await page.locator("#chipTime").innerText();
  check("a window from a rewound clock is not read back as a month",
    /^[0-5]:\d\d restantes$/.test(absurd), absurd);
  check("and he is simply happy, for the five minutes it can actually be",
    (await page.locator("#chipState").innerText()) === "Heureux");
  const healed = await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")).sheep.happyUntil);
  check("and the save is healed rather than left telling it",
    healed <= Date.now() + 5 * 60 * 1000 + 2000, `${Math.round((healed - Date.now()) / 1000)}s out`);
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
  check("and the blob is current", migrated.blob.v === 4 && migrated.blob.valley.unlocked.includes("riviere"));
  await page.close();

  // --- an older blob is climbed, not discarded: every v2 fixture above proves
  // the fields it knew survive, so this proves the ones it never had appear
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, {
    "nuage:save": JSON.stringify({
      v: 2,
      sheep: { happyUntil: 0, woolFrom: Date.now() - 3 * 60 * 1000 },
      care: { fed: 2 },
      valley: { unlocked: ["riviere"], solves: { riviere: 4 } },
      prefs: { sound: true },
    }),
  });
  const climbed = await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")));
  check("a v2 save is upgraded in place", climbed.v === 4, JSON.stringify(climbed).slice(0, 90));
  check("the upgrade keeps what v2 knew", climbed.care.fed === 2 && climbed.valley.solves.riviere === 4);
  check("and defaults what it did not", climbed.care.shorn === 0 && climbed.valley.at === "pre");
  check("he has been where he is", climbed.valley.visited.includes("pre"));
  await page.close();

  // --- a board half-played survives a reload, and a nonsense one does not
  // half-apply: it is refused whole and he is given a fresh crossing instead
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, {
    "nuage:save": JSON.stringify({
      v: 4, sheep: { happyUntil: 0, woolFrom: 0 }, care: { fed: 5, shorn: 0 },
      valley: {
        at: "riviere", visited: ["pre", "riviere"], unlocked: ["riviere"], solves: {},
        boards: { riviere: { boat: "R", where: { loup: "L", mouton: "R", chou: "L" }, moves: 3, phase: "idle", past: [] } },
      },
      prefs: { sound: false },
    }),
  });
  await page.waitForTimeout(900);
  const live = await page.locator("#live").innerText();
  check("a half-played crossing comes back", live.includes("Rive droite : Nuage"), live);
  check("with the moves he had made", (await page.locator("#crossMoves").innerText()).startsWith("3"),
    await page.locator("#crossMoves").innerText());
  await page.close();

  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, {
    "nuage:save": JSON.stringify({
      v: 4, sheep: { happyUntil: 0, woolFrom: 0 }, care: { fed: 5, shorn: 0 },
      valley: {
        at: "riviere", visited: ["pre", "riviere"], unlocked: ["riviere"], solves: {},
        boards: { riviere: { boat: "sideways", where: { loup: "elsewhere" }, moves: -4 } },
      },
      prefs: { sound: false },
    }),
  });
  await page.waitForTimeout(900);
  const fresh = await page.locator("#live").innerText();
  check("a board that makes no sense is refused whole", fresh.includes("Rive droite : personne"), fresh);
  check("and he is simply given a fresh crossing", (await page.locator("#crossMoves").innerText()).startsWith("0"));
  await page.close();
};
