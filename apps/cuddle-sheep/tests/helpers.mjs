// Shared moves. Everything here drives the app the way a player would —
// pointer paths and keys, never internal state — so the tests keep working
// through refactors of the code they cover.

export const boot = async (page, APP, save = {}) => {
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, String(v));
  }, save);
  await page.goto(APP);
  await page.waitForTimeout(1000);
  return page;
};

/** Stroke him: the only thing that makes him happy. */
export const cuddle = async (page, strokes = 46) => {
  const box = await page.locator("#sheep").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height * 0.62;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 0; i < strokes; i++) {
    await page.mouse.move(cx + Math.sin(i / 2.4) * box.width * 0.14, cy + Math.cos(i / 3) * 30, { steps: 3 });
    await page.waitForTimeout(14);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
};

export const tapSheep = async (page) => {
  const box = await page.locator("#sheep").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.62);
  await page.waitForTimeout(320);
};

export const clickMid = async (page, sel, fy = 0.6) => {
  const b = await page.locator(sel).boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height * fy);
  await page.waitForTimeout(320);
};

/** What would actually receive a click at the middle of this thing? */
export const topAt = (page, sel, fx = 0.5, fy = 0.55) => page.evaluate(([sel, fx, fy]) => {
  const el = document.querySelector(sel);
  if (!el) return "missing";
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
  if (!hit) return "nothing";
  const named = hit.closest(".clover,.shears,.sprout,.tok,#boat,#hit,button");
  return named ? (named.id || named.getAttribute("class")) : (hit.id || hit.tagName);
}, [sel, fx, fy]);

/** Every way the layout can be wrong, measured rather than eyeballed. */
export const geometryIssues = (page) => page.evaluate(() => {
  const vw = innerWidth, vh = innerHeight, issues = [];
  const rect = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return r.width || r.height ? r : null;
  };
  if (document.documentElement.scrollWidth > vw + 1) issues.push("the page scrolls horizontally");
  // `.cross-ui` was checked here for a long time and has never existed — the bars
  // are `.place-ui`, and there are six of them now. So the control bar was the one
  // piece of chrome the geometry sweep never actually looked at.
  const bars = [...document.querySelectorAll(".place-ui")]
    .filter((b) => getComputedStyle(b).display !== "none");
  for (const sel of [".brand", ".hud__right", "#sound", ".hint"]) {
    const r = rect(sel);
    if (!r) continue;
    if (r.right > vw + 1) issues.push(`${sel} overflows right by ${Math.round(r.right - vw)}px`);
    if (r.left < -1) issues.push(`${sel} overflows left by ${Math.round(-r.left)}px`);
    if (r.bottom > vh + 1) issues.push(`${sel} overflows bottom by ${Math.round(r.bottom - vh)}px`);
  }
  for (const bar of bars) {
    const r = bar.getBoundingClientRect();
    if (r.right > vw + 1) issues.push(`#${bar.id} overflows right by ${Math.round(r.right - vw)}px`);
    if (r.left < -1) issues.push(`#${bar.id} overflows left by ${Math.round(-r.left)}px`);
    if (r.bottom > vh + 1) issues.push(`#${bar.id} overflows bottom by ${Math.round(r.bottom - vh)}px`);
    if (r.top < 0) issues.push(`#${bar.id} overflows top by ${Math.round(-r.top)}px`);
  }
  const boxes = (a, b) => {
    const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return x > 4 && y > 4 ? `${Math.round(x)}x${Math.round(y)}px` : null;
  };
  const overlap = (a, b) => {
    const ra = rect(a), rb = rect(b);
    if (!ra || !rb) return;
    const hit = boxes(ra, rb);
    if (hit) issues.push(`${a} overlaps ${b} by ${hit}`);
  };
  overlap(".brand", ".hud__right");
  for (const bar of bars) {
    const hint = rect(".hint");
    if (hint) {
      const hit = boxes(hint, bar.getBoundingClientRect());
      if (hit) issues.push(`.hint overlaps #${bar.id} by ${hit}`);
    }
  }

  // The ways out of a place are drawn at the borders of its frame, so they are the
  // one chrome living in world space. A marker outside the frame keeps
  // its click target (overflow:hidden hides it but does not unhit it), which is how
  // the way home once ended up unreachable underneath a control bar.
  const layer = document.querySelector("#valleyFront");
  if (layer && getComputedStyle(layer).visibility !== "hidden") {
    const lb = layer.getBoundingClientRect();
    // only HIS ways out — a neighbour's are legitimately outside the frame, which
    // is the whole point of showing them in the letterbox margin
    for (const p of document.querySelectorAll("g[data-layer]:not([inert]) .edge")) {
      const r = p.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const name = p.nextElementSibling?.textContent ?? p.dataset.dir;
      if (cy < lb.top || cy > lb.bottom || cx < lb.left || cx > lb.right) {
        issues.push(`the "${name}" edge is outside the frame`);
      } else if (!document.elementFromPoint(cx, cy)?.closest(".edge")) {
        issues.push(`the "${name}" edge is covered by something`);
      }
      // Reachable is not the same as tappable. A diorama is letterboxed to fit, so at
      // 320px the projection is ~0.44 — an early version of these drew at 18px, which
      // a mouse can hit and a thumb cannot. A floor marker cannot counter-scale for
      // that without breaking the perspective it is drawn in, so the target is an
      // oversized invisible rect instead. This is the number that says it worked.
      if (Math.min(r.width, r.height) < 38) {
        issues.push(`the "${name}" edge is only ${Math.round(Math.min(r.width, r.height))}px across`);
      }
    }
  }
  const sheep = rect("#sheep");
  if (sheep) {
    if (sheep.top < -2) issues.push(`the sheep is cut off at the top by ${Math.round(-sheep.top)}px`);
    if (sheep.bottom > vh + 2) issues.push(`the sheep is cut off at the bottom by ${Math.round(sheep.bottom - vh)}px`);
  }
  return issues;
});

/** Which dioramas are in the document, by place id.
 *
 *  Invariant 9 used to mean "exactly one". It now means "the one he is in, plus at
 *  most its two open neighbours" — a sleeping place still LEAVES the document, but a
 *  neighbour is deliberately shown in the letterbox margin, inert, so the valley reads
 *  as continuous. Anything further away must still be gone. */
export const liveBands = (page) => page.evaluate(() =>
  [...new Set([...document.querySelectorAll("#valleyBack > g[data-layer], #valleyFront > g[data-layer]")]
    .map((g) => g.id.replace(/^(back|front)-/, "")))].sort());

/** ...and of those, the ones you are only looking at. */
export const peeking = (page) => page.evaluate(() =>
  [...new Set([...document.querySelectorAll("#valleyBack > g[data-layer][inert]")]
    .map((g) => g.id.replace(/^back-/, "")))].sort());

export const VIEWPORTS = [
  ["desktop-wide", 1920, 1080], ["desktop", 1280, 800], ["laptop-short", 1280, 560],
  ["ipad-land", 1024, 768], ["ipad-port", 768, 1024], ["phone-land", 844, 390],
  ["phone", 390, 844], ["phone-small", 360, 640], ["phone-tiny", 320, 568],
  ["ultrawide", 2560, 1080],
];

/* ---- reading actual pixels -------------------------------------------- *
 * Some things can only be settled by looking at what the compositor did.
 * A blend mode's effect on the distance between two palettes is one of them:
 * modelling it means assuming a grade colour and ignoring every layer over it,
 * and the modelled answer and the real one differ by a lot. Playwright hands
 * back a PNG; this is the smallest correct reader for one. */
import { inflateSync } from "node:zlib";

const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** → { width, height, pixels: Uint8Array (RGBA) } for an 8-bit non-interlaced PNG. */
export const decodePNG = (buf) => {
  let at = 8, width = 0, height = 0, colour = 6;
  const parts = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString("ascii", at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + len);
    if (type === "IHDR") { width = body.readUInt32BE(0); height = body.readUInt32BE(4); colour = body[9]; }
    if (type === "IDAT") parts.push(body);
    at += len + 12;
  }
  const bpp = colour === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(parts));
  const out = new Uint8Array(width * height * 4);
  const stride = width * bpp;
  const line = new Uint8Array(stride), prev = new Uint8Array(stride);
  for (let y = 0, p = 0; y < height; y++) {
    const filter = raw[p++];
    for (let i = 0; i < stride; i++) {
      const x = raw[p + i];
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      line[i] = (x + (filter === 1 ? a : filter === 2 ? b : filter === 3 ? ((a + b) >> 1) : filter === 4 ? paeth(a, b, c) : 0)) & 255;
    }
    p += stride;
    for (let x = 0; x < width; x++) {
      out[(y * width + x) * 4] = line[x * bpp];
      out[(y * width + x) * 4 + 1] = line[x * bpp + 1];
      out[(y * width + x) * 4 + 2] = line[x * bpp + 2];
      out[(y * width + x) * 4 + 3] = 255;
    }
    prev.set(line);
  }
  return { width, height, pixels: out };
};

/** The average colour of a patch of the live page, as actually composited. */
export const patch = async (page, clip) => {
  const { pixels } = decodePNG(await page.screenshot({ clip }));
  const n = pixels.length / 4;
  const sum = [0, 0, 0];
  for (let i = 0; i < n; i++) for (const k of [0, 1, 2]) sum[k] += pixels[i * 4 + k];
  return sum.map((v) => v / n);
};
