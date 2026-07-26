// Per puzzle: the optimal solution wins, every illegal pair is caught, undo
// rewinds it — and no sequence of moves can produce a loss.
import { boot, tapSheep, clickMid } from "./helpers.mjs";

const row = async (page) => { await page.locator("#crossRow").click(); await page.waitForTimeout(1300); };

export default async ({ newPage, check, APP }) => {
  const page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, { "nuage:unlocked": 1 });
  await page.keyboard.press("j");
  await page.waitForTimeout(1500);
  check("the four-leaf clover opens the crossing", (await page.evaluate(() => document.documentElement.dataset.mode)) === "cross");

  // leaving the sheep with the cabbage is caught on arrival
  await clickMid(page, "#tokLoup");
  await row(page);
  check("sheep + cabbage alone is caught", (await page.locator("#live").innerText()).includes("mangé le chou"));
  check("and it is a rewind, not a loss", (await page.locator("#crossUndo").isEnabled()));
  await page.waitForTimeout(1500);          // let the choreography finish first
  const moves = () => page.locator("#crossMoves").innerText();
  check("the failed crossing counted as a move", (await moves()).startsWith("1"));
  await page.locator("#crossUndo").click();
  await page.waitForTimeout(700);
  check("undo gives the move back", (await moves()).startsWith("0"));
  const board = await page.locator("#live").innerText();
  check("undo puts everyone back on the left bank", board.includes("Rive droite : personne"), board);

  // leaving the wolf with the sheep is caught too
  await page.locator("#crossReset").click();
  await page.waitForTimeout(500);
  await clickMid(page, "#tokChou");
  await row(page);
  check("wolf + sheep alone is caught", (await page.locator("#live").innerText()).includes("câlin non autorisé"));
  await page.locator("#crossReset").click();
  await page.waitForTimeout(500);

  // painter order is computed, not hand-wired: a piece nearer the camera than
  // Nuage must be drawn in the layer in front of him, and behind when it is not
  const layerOfChou = () => page.evaluate(() => document.querySelector("#tokChou").parentElement.id);
  check("the cabbage starts in front of him", (await layerOfChou()) === "crossFront");

  // The case that separates the computed rule from the hand-wired one it replaced:
  // the old code moved the cabbage behind him whenever it was aboard. Aboard the
  // boat with Nuage still on the NEAR bank, the boat is closer to the camera, so
  // the cabbage belongs in front. The old rule got this wrong.
  await clickMid(page, "#tokChou");
  check("aboard, with him on the near bank, it stays in front", (await layerOfChou()) === "crossFront");
  await clickMid(page, "#tokChou");     // put it back ashore
  await tapSheep(page);                 // Nuage crosses, so he becomes the far piece
  await row(page);
  await row(page);                      // the boat comes back empty
  await clickMid(page, "#tokChou");     // and the cabbage boards
  check("aboard, with him on the far bank, it moves behind him", (await layerOfChou()) === "crossBack");
  await page.locator("#crossReset").click();
  await page.waitForTimeout(600);
  check("a reset puts it back in front", (await layerOfChou()) === "crossFront");

  // the optimal seven
  for (const step of ["sheep", null, "#tokLoup", "sheep", "#tokChou", null, "sheep"]) {
    if (step === "sheep") await tapSheep(page);
    else if (step) await clickMid(page, step);
    await row(page);
  }
  await page.waitForTimeout(1200);
  const live = await page.locator("#live").innerText();
  check("the optimal solution wins", live.includes("Tout le monde est passé en 7"), live);
  check("and it says so", live.includes("optimale"));
  check("the pennant goes up", (await page.locator("#pennant.up").count()) === 1);
  check("the reward is a clover in the meadow", (await page.locator(".clover").count()) === 4);
  await page.close();
};
