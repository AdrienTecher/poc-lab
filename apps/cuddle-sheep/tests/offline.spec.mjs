// The object: installable, and playable with the network switched off.
//
// The claim being tested is not "a service worker is registered" — that is easy and
// proves nothing. It is that with the browser genuinely offline, a cold navigation
// still opens onto a meadow with a sheep in it, his clocks intact, and no request
// leaving the origin. So the network is cut for real and the page reloaded.
const SAVE = JSON.stringify({
  v: 4, sheep: { happyUntil: 0, woolFrom: Date.now() - 60 * 1000 },
  care: { fed: 5, shorn: 3 },
  valley: { at: "pre", visited: ["pre"], unlocked: ["riviere", "grange"], solves: {}, boards: {} },
  prefs: { sound: false },
});

/** Wait until a worker is not just registered but ACTIVE and controlling the page —
 *  a registration that has not activated yet caches nothing. */
const controlled = (page, cap = 12000) => page.evaluate(async (ms) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.active && navigator.serviceWorker.controller) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}, cap);

export default async ({ newPage, check, APP }) => {
  const page = await newPage({ viewport: { width: 1280, height: 800 } });

  // every request the page makes, so "nothing third-party" can be asserted rather
  // than assumed — the Google Fonts links this app used to carry are the reason
  const external = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.origin !== new URL(APP).origin && u.protocol !== "data:") external.push(u.origin);
  });

  await page.addInitScript((s) => localStorage.setItem("nuage:save", s), SAVE);
  await page.goto(APP);
  await page.waitForTimeout(1200);

  check("nothing is fetched from another origin", external.length === 0, [...new Set(external)].join(", "));

  /* ---- the manifest is real, and says what an installed app needs ---- */
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href;
    if (!href) return null;
    const res = await fetch(href);
    return res.ok ? res.json() : null;
  });
  check("there is a manifest and it parses", manifest !== null);
  check("it names the app and can be installed",
    manifest?.name?.startsWith("Nuage") && manifest?.display === "standalone"
    && typeof manifest?.start_url === "string",
    JSON.stringify({ name: manifest?.name, display: manifest?.display, start: manifest?.start_url }));
  // Android crops an icon to a circle, so a maskable one is what stops him losing
  // his ears on a home screen
  const purposes = (manifest?.icons ?? []).map((i) => i.purpose);
  check("with a maskable icon as well as a plain one",
    purposes.includes("maskable") && purposes.includes("any"), purposes.join("|"));

  const icons = await page.evaluate(async (list) => {
    const out = [];
    for (const i of list) {
      const res = await fetch(new URL(i.src, document.querySelector('link[rel="manifest"]').href));
      out.push({ src: i.src, ok: res.ok, type: res.headers.get("content-type") });
    }
    return out;
  }, manifest?.icons ?? []);
  check("and every icon actually resolves", icons.every((i) => i.ok && /png/.test(i.type ?? "")),
    icons.map((i) => `${i.src}:${i.ok}`).join(" "));

  /* ---- the worker takes control ---- */
  check("the service worker activates and takes the page", await controlled(page));

  /* ---- THE check: pull the plug ---- */
  await page.context().setOffline(true);
  await page.reload();
  await page.waitForTimeout(1600);

  const offline = await page.evaluate(() => ({
    sheep: !!document.querySelector("#sheep"),
    meadow: !!document.querySelector("#meadow .clover"),
    // the styling has to survive too, or "it loaded" means an unstyled document
    styled: getComputedStyle(document.querySelector(".hud")).position === "absolute",
    font: getComputedStyle(document.querySelector(".brand h1")).fontFamily,
    chip: document.querySelector("#chipState")?.textContent,
  }));
  check("offline, a cold reload still opens onto the meadow", offline.sheep && offline.meadow,
    JSON.stringify(offline));
  check("and it is styled, not a bare document", offline.styled, `hud position ${offline.styled}`);
  check("and the lettering is there, because the fonts are ours now",
    /Fredoka/.test(offline.font), offline.font);
  check("and his clocks still read", typeof offline.chip === "string" && offline.chip.length > 0,
    String(offline.chip));

  // and he is still tappable offline — a cached shell that cannot be played with
  // would be a screenshot, not an app
  const box = await page.locator("#sheep").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.62);
  await page.waitForTimeout(400);
  check("and he answers when you touch him offline",
    (await page.locator("#live").innerText()).length > 0);

  await page.context().setOffline(false);
  await page.close();

  // ...and prove the worker is what is doing it. Every check above passed once while
  // the worker was silently NOT registered, served instead by the browser's own HTTP
  // cache — so "it worked offline" on its own says nothing about whether any of this
  // code runs. A fresh context has neither cache nor worker: offline, it must fail.
  const cold = await newPage({ viewport: { width: 1280, height: 800 } });
  await cold.context().setOffline(true);
  let reached = true;
  try {
    await cold.goto(APP, { timeout: 8000 });
  } catch {
    reached = false;
  }
  check("and without the worker there is nothing to open — so the worker is what did it",
    !reached, "a cold offline context still loaded the app, so the cache under test may not be ours");
  await cold.close();
};
