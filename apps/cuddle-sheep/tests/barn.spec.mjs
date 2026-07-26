// La grange: the bales are the fleeces, a big one never sits on a small one,
// and — as everywhere in this valley — a mistake is a sentence, never a loss.
import { boot } from "./helpers.mjs";

const SAVE = (over = {}) => ({
  "nuage:save": JSON.stringify({
    v: 3,
    sheep: { happyUntil: 0, woolFrom: Date.now() - 60 * 1000 },
    care: { fed: 0, shorn: 3 },
    valley: { at: "pre", visited: ["pre"], unlocked: ["grange"], solves: {} },
    prefs: { sound: false },
    ...over,
  }),
});

/** What is on each post, read out of the world rather than out of its
 *  internals: which post each bale is nearest, by the transform the renderer
 *  actually wrote. A carried bale rides over a post without being on it, so it
 *  is excluded; sizes are sorted because DOM order is painter order, not stack
 *  order. */
const stacks = (page) => page.evaluate(() => {
  const posts = [...document.querySelectorAll(".post")].map((p) => {
    const r = p.getBoundingClientRect();
    return r.left + r.width / 2;
  });
  const out = posts.map(() => []);
  for (const bale of document.querySelectorAll(".bale:not(.carried)")) {
    const r = bale.getBoundingClientRect();
    const x = r.left + r.width / 2;
    let best = 0;
    for (const [i, px] of posts.entries()) if (Math.abs(px - x) < Math.abs(posts[best] - x)) best = i;
    out[best].push(Number(bale.dataset.bale));
  }
  return JSON.stringify(out.map((s) => s.sort()));
});

export default async ({ newPage, check, APP }) => {
  let page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, SAVE());

  // --- the door is earned by shearing, and it is a door, not a menu item
  check("three fleeces open the barn", (await page.locator(".gate.open").count()) === 1);
  const gate = await page.locator(".gate").boundingBox();
  await page.mouse.click(gate.x + gate.width / 2, gate.y + gate.height * 0.6);
  await page.waitForTimeout(1600);
  check("the gate walks him into the barn", (await page.evaluate(() => document.documentElement.dataset.mode)) === "barn");
  check("and the save knows where he is",
    (await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")).valley.at)) === "grange");

  // --- the river is not merely hidden from the barn, it is out of the document
  const bands = await page.evaluate(() =>
    [...document.querySelectorAll("#valleyBack > g, #valleyFront > g")].map((g) => g.id));
  check("no other diorama is in the document", !bands.some((id) => id.includes("riviere")), bands.join(","));

  check("all three bales start on the first post", (await stacks(page)) === "[[0,1,2],[],[]]", await stacks(page));

  // --- a big bale on a small one is refused, and refused kindly
  await page.keyboard.press("1");                 // lift the small one
  await page.waitForTimeout(500);
  await page.keyboard.press("2");                 // set it on the empty middle post
  await page.waitForTimeout(500);
  await page.keyboard.press("1");                 // lift the medium one
  await page.waitForTimeout(500);
  await page.keyboard.press("2");                 // ...onto the small one: refused
  await page.waitForTimeout(500);
  check("a bigger bale is refused", (await page.locator("#live").innerText()).includes("Trop gros"));
  check("and nothing is lost by trying", (await stacks(page)) === "[[2],[0],[]]", await stacks(page));

  // he is still carrying it, so it can simply go somewhere else
  await page.keyboard.press("3");
  await page.waitForTimeout(500);
  check("the refused bale goes elsewhere", (await stacks(page)) === "[[2],[0],[1]]", await stacks(page));

  // --- undo rewinds a placement
  await page.locator("#barnUndo").click();
  await page.waitForTimeout(500);
  // a move is a lift AND a placing, so one undo rewinds the whole of it
  check("undo takes the bale back to where it was lifted", (await stacks(page)) === "[[1,2],[0],[]]", await stacks(page));
  await page.locator("#barnReset").click();
  await page.waitForTimeout(500);
  check("a reset puts them all back", (await stacks(page)) === "[[0,1,2],[],[]]", await stacks(page));
  await page.close();

  // --- the optimal seven, and what it earns
  page = await newPage({ viewport: { width: 1280, height: 800 } });
  await boot(page, APP, SAVE());
  await page.keyboard.press("g");
  const gate2 = await page.locator(".gate").boundingBox();
  await page.mouse.click(gate2.x + gate2.width / 2, gate2.y + gate2.height * 0.6);
  await page.waitForTimeout(1600);
  // small→3, medium→2, small→2, big→3, small→1, medium→3, small→3
  for (const [from, to] of [[1, 3], [1, 2], [3, 2], [1, 3], [2, 1], [2, 3], [1, 3]]) {
    await page.keyboard.press(String(from));
    await page.waitForTimeout(260);
    await page.keyboard.press(String(to));
    await page.waitForTimeout(260);
  }
  await page.waitForTimeout(900);
  const live = await page.locator("#live").innerText();
  check("the optimal solution stacks them", live.includes("en 7 déplacements"), live);
  check("and it says so", live.includes("optimale"), live);
  check("the solve is remembered",
    (await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")).valley.solves.grange)) === 1);

  // --- leaving is always one button away, and puts him back in the meadow
  await page.locator(".way__plank").last().click();   // the plank home
  await page.waitForTimeout(900);
  check("the barn is left for the meadow",
    (await page.evaluate(() => document.documentElement.dataset.mode)) === undefined);
  check("and the save says so",
    (await page.evaluate(() => JSON.parse(localStorage.getItem("nuage:save")).valley.at)) === "pre");
  await page.close();
};
