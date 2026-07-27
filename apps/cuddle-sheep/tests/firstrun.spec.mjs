// The very first time anybody opens it: no save, no history, nothing earned.
//
// Written after looking rather than after redesigning — the first run turned out to
// be right already, so what this does is stop it drifting. Three things carry it and
// all three are easy to break by accident later.
import { cuddle } from "./helpers.mjs";

export default async ({ newPage, check, APP }) => {
  // a phone, because that is where a first visit most often happens
  const page = await newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(APP);            // deliberately NO seeded save
  await page.waitForTimeout(1500);

  check("a first visit starts with an empty save",
    (await page.evaluate(() => localStorage.getItem("nuage:save") === null
      || JSON.parse(localStorage.getItem("nuage:save")).care.fed === 0)));

  /* ---- 1. the one instruction stays up ---- */
  // setHint takes its words back after 6.5s, which is right for a hint and wrong for
  // the only thing a new player has been told. The opening line is written into the
  // markup and nothing retracts it, so it waits as long as they do.
  const hint = () => page.evaluate(() => ({
    text: document.querySelector("#hintText")?.innerText.replace(/\s+/g, " ").trim(),
    up: !document.querySelector("#hint").classList.contains("gone"),
  }));
  const opening = await hint();
  check("he is introduced with something to do", /caresse/i.test(opening.text), opening.text);
  await page.waitForTimeout(7500);
  const later = await hint();
  check("and the instruction is still there after eight seconds", later.up && later.text === opening.text,
    `up=${later.up} "${later.text}"`);

  /* ---- 2. nothing unearned is on screen ---- */
  const hidden = await page.evaluate(() => Object.fromEntries(
    [".sprout", ".gate", ".pelote", ".chien"].map((s) => {
      const e = document.querySelector(s);
      return [s, e ? getComputedStyle(e).display : "missing"];
    })));
  check("no door, no ball of wool and no dog before any of them is earned",
    Object.values(hidden).every((d) => d === "none"), JSON.stringify(hidden));
  check("but the things he starts with are there",
    (await page.locator(".clover").count()) >= 3 && (await page.locator(".shears").count()) === 1);

  /* ---- 3. and nothing unearned can be reached by keyboard ---- */
  // The rule this protects is older than the first run: nothing invisible is
  // tabbable. A hidden door that still takes a Tab stop is a door.
  const reachable = await page.evaluate(() => [...document.querySelectorAll('[tabindex="0"]')]
    .map((e) => {
      const hiddenBy = e.closest('[style*="display: none"]')
        || (getComputedStyle(e).display === "none" ? e : null);
      return { label: e.id || e.getAttribute("aria-label") || e.tagName, hidden: !!hiddenBy };
    }));
  check("nothing that is hidden is also tabbable",
    reachable.every((r) => !r.hidden), reachable.filter((r) => r.hidden).map((r) => r.label).join(", "));

  /* ---- and the loop works from cold ---- */
  check("he starts out sad, which is the whole point of the loop",
    (await page.locator("#chipState").innerText()) === "Il boude");
  await cuddle(page);
  check("a first cuddle makes him happy", (await page.locator("#chipState").innerText()) === "Heureux",
    await page.locator("#chipState").innerText());
  check("and takes the instruction away, having been followed",
    !(await hint()).up);
  check("and it is written down, so a reload does not forget his first cuddle",
    (await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")).sheep.happyUntil)) > Date.now());
  await page.close();
};
