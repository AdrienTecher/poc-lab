// Protects the click-eating class of bug, and every verb a player has.
import { boot, cuddle, topAt, clickMid } from "./helpers.mjs";

const MINUTE = 60 * 1000;

export default async ({ newPage, check, APP }) => {
  // --- the core loop: only a cuddle makes him happy, and it lasts five minutes
  let page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP);
  check("starts sad", (await page.locator("#chipState").innerText()) === "Il boude");
  await cuddle(page);
  check("stroking him makes him happy", (await page.locator("#chipState").innerText()) === "Heureux");
  const left = await page.locator("#chipTime").innerText();
  check("the window is five minutes", /^(5:00|4:5\d) restantes$/.test(left), left);

  // --- feeding tops up a running window and may never start one
  const seconds = async () => {
    const [, m, sec] = (await page.locator("#chipTime").innerText()).match(/(\d+):(\d+)/) ?? [];
    return m === undefined ? 0 : Number(m) * 60 + Number(sec);
  };
  await page.keyboard.press("f");
  await page.waitForTimeout(1200);
  check("a clover is eaten", (await page.locator("#live").innerText()).includes("trèfle"));
  const fedWhileHappy = await seconds();
  check("feeding a happy sheep never passes the five-minute cap", fedWhileHappy <= 300, `${fedWhileHappy}s`);
  await page.close();

  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP);
  await page.keyboard.press("f");
  await page.waitForTimeout(1400);
  check("feeding a sad sheep does not make him happy", (await page.locator("#chipState").innerText()) === "Il boude");
  check("and starts no window at all", (await page.locator("#chipTime").innerText()) === "—:—");
  check("he says so himself", (await page.locator("#live").innerText()).includes("câlins qui le rendent heureux"));
  await page.close();

  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP);
  await cuddle(page);

  // --- everything in the meadow is clickable where it looks clickable
  // the one just eaten is deliberately inert, so ask a clover still in the grass
  for (const sel of [".clover:not(.picked)", ".shears"]) {
    const label = sel.split(":")[0];
    check(`${label} takes its own clicks`, (await topAt(page, sel)).includes(label.slice(1)));
  }
  check("the sheep takes clicks on his body", (await topAt(page, "#sheep", 0.5, 0.62)) === "hit");
  await page.close();

  // --- shearing is gated on a settled sheep, and refuses out loud
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, { "nuage:wool-from": Date.now() - 15 * MINUTE });
  check("a full fleece asks to be shorn", (await page.locator("#woolState").innerText()) === "À tondre");
  await clickMid(page, ".shears", 0.5);
  const box = await page.locator("#sheep").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height * 0.6;
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 0; i < 24; i++) { await page.mouse.move(cx + Math.sin(i / 2) * 90, cy + Math.cos(i / 3) * 30, { steps: 3 }); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(300);
  check("a sad sheep will not be shorn", (await page.locator("#woolPct").innerText()) === "100 %");
  check("and he says why", (await page.locator("#live").innerText()).includes("rassurer"));

  await page.mouse.click(60, 200);            // put the shears back
  await cuddle(page);
  await clickMid(page, ".shears", 0.5);
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 0; i < 90; i++) { await page.mouse.move(cx + Math.sin(i / 2) * 110, cy + Math.cos(i / 3) * 36, { steps: 3 }); await page.waitForTimeout(12); }
  await page.mouse.up();
  await page.waitForTimeout(1200);
  check("a settled sheep is shorn", Number((await page.locator("#woolPct").innerText()).replace(/\D/g, "")) <= 2);
  check("the fleece becomes a cloud", (await page.locator("#cloudbank .puff").count()) > 5);
  await page.close();

  // --- the shears from the keyboard: t takes them, and anything else lets go
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, { "nuage:wool-from": Date.now() - 15 * MINUTE });
  const holding = () => page.evaluate(() => document.body.classList.contains("tooling"));
  await page.keyboard.press("t");
  await page.waitForTimeout(300);
  check("t takes the shears", await holding());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  check("Escape puts them back", !(await holding()));
  await page.keyboard.press("t");
  await page.waitForTimeout(250);
  await page.mouse.click(6, 400);              // anywhere outside the world
  await page.waitForTimeout(250);
  check("clicking elsewhere puts them back", !(await holding()));

  await cuddle(page);                          // he holds still for the blades once settled
  await page.keyboard.press("t");
  await page.waitForTimeout(250);
  const pct = async () => Number((await page.locator("#woolPct").innerText()).replace(/\D/g, ""));
  const fleece = await pct();
  await page.locator("#hit").focus();
  await page.keyboard.down(" ");
  const shorn = await page
    .waitForFunction((was) => Number(document.querySelector("#woolPct").textContent.replace(/\D/g, "")) < was, fleece, { timeout: 10000 })
    .then(() => true, () => false);
  await page.keyboard.up(" ");
  check("holding Space with them in hand shears him", shorn, `still ${await pct()}% of ${fleece}%`);
  await page.close();

  // --- keyboard only
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, { "nuage:unlocked": 1 });
  // the hold accumulates dt, not wall-clock, so a busy machine fills it slower —
  // wait for the state rather than guessing a duration
  await page.locator("#hit").focus();
  await page.keyboard.down(" ");
  const held = await page
    .waitForFunction(() => document.querySelector("#chipState").textContent === "Heureux", null, { timeout: 10000 })
    .then(() => true, () => false);
  await page.keyboard.up(" ");
  check("holding Space cuddles him", held);

  // --- nothing invisible is reachable by Tab, in either mode
  const order = async (n) => {
    const seen = [];
    for (let i = 0; i < n; i++) {
      await page.keyboard.press("Tab");
      seen.push(await page.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body) return "body";
        const shown = e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
        return shown ? "shown" : `HIDDEN:${e.id || e.getAttribute("class")}`;
      }));
    }
    return seen;
  };
  const meadowTab = await order(8);
  check("no hidden control is tabbable in the meadow", !meadowTab.some((s) => s.startsWith("HIDDEN")), meadowTab.join(","));
  await page.keyboard.press("j");
  await page.waitForTimeout(1400);
  const crossTab = await order(8);
  check("no hidden control is tabbable in the crossing", !crossTab.some((s) => s.startsWith("HIDDEN")), crossTab.join(","));
  await page.close();
};
