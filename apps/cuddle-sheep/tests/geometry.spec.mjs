// Protects the window-sizing class of bug: a sheep cut off by a short window,
// a hint line that makes the page scroll sideways, chrome that overlaps chrome.
import { boot, geometryIssues, VIEWPORTS } from "./helpers.mjs";

export default async ({ newPage, check, APP }) => {
  for (const [name, width, height] of VIEWPORTS) {
    const page = await newPage({ viewport: { width, height } });
    await boot(page, APP, { "nuage:unlocked": 1 });

    const meadow = await geometryIssues(page);
    check(`${name} · meadow fits`, meadow.length === 0, meadow.join(" | "));

    await page.keyboard.press("j");
    await page.waitForTimeout(1400);
    const cross = await geometryIssues(page);
    check(`${name} · crossing fits`, cross.length === 0, cross.join(" | "));

    await page.close();
  }
};
