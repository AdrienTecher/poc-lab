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
  for (const sel of [".brand", ".hud__right", "#sound", ".hint", ".cross-ui"]) {
    const r = rect(sel);
    if (!r) continue;
    if (r.right > vw + 1) issues.push(`${sel} overflows right by ${Math.round(r.right - vw)}px`);
    if (r.left < -1) issues.push(`${sel} overflows left by ${Math.round(-r.left)}px`);
    if (r.bottom > vh + 1) issues.push(`${sel} overflows bottom by ${Math.round(r.bottom - vh)}px`);
  }
  const overlap = (a, b) => {
    const ra = rect(a), rb = rect(b);
    if (!ra || !rb) return;
    const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
    const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (x > 4 && y > 4) issues.push(`${a} overlaps ${b} by ${Math.round(x)}x${Math.round(y)}px`);
  };
  overlap(".brand", ".hud__right");
  overlap(".hint", ".cross-ui");
  const sheep = rect("#sheep");
  if (sheep) {
    if (sheep.top < -2) issues.push(`the sheep is cut off at the top by ${Math.round(-sheep.top)}px`);
    if (sheep.bottom > vh + 2) issues.push(`the sheep is cut off at the bottom by ${Math.round(sheep.bottom - vh)}px`);
  }
  return issues;
});

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
