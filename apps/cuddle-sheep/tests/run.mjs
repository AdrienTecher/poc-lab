// Test harness: no framework, one Chromium, every spec gets a fresh page.
//   node tests/run.mjs            all specs
//   node tests/run.mjs geometry   just the ones whose name matches
//
// Playwright is deliberately NOT a dependency of this package: adding it would
// make every CI deploy download a browser it never uses. Install it once where
// you run the tests — `pnpm add -Dw playwright` or a global install — and point
// CHROMIUM at a binary if Playwright cannot find one.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serve } from "./serve.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "..", "..", "..", "dist");

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("playwright is not installed. Run `pnpm add -Dw playwright`, then `pnpm build` and retry.");
  process.exit(2);
}

const SPECS = ["geometry", "interactions", "puzzles", "barn", "pont", "clocher", "cloture", "lisiere", "travel", "offline", "calm", "firstrun", "carte", "sound", "day", "save"];
const only = process.argv.slice(2);
const picked = only.length ? SPECS.filter((s) => only.some((o) => s.includes(o))) : SPECS;
if (!picked.length) {
  console.error(`no spec matches ${only.join(" ")} — known specs: ${SPECS.join(", ")}`);
  process.exit(2);
}

const results = [];
export const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail && !ok ? ` — ${detail}` : ""}`);
};

const server = await serve(DIST);
const browser = await chromium.launch({
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
});

// Every page fails the run on an uncaught error or a console error: a comfort
// toy that throws mid-cuddle is broken even if the assertion after it passes.
export const newPage = async (opts = {}) => {
  const page = await browser.newPage({ deviceScaleFactor: 1, ...opts });
  page.on("pageerror", (e) => check(`no page error (${e.message.slice(0, 60)})`, false));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("ERR_CONNECTION")) {
      check(`no console error (${m.text().slice(0, 60)})`, false);
    }
  });
  return page;
};

export const APP = `${server.url}poc-lab/cuddle-sheep/`;

for (const spec of picked) {
  console.log(`\n${spec}`);
  const mod = await import(`./${spec}.spec.mjs`);
  await mod.default({ newPage, check, APP });
}

await browser.close();
await server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  for (const f of failed) console.log(`  FAIL ${f.name} ${f.detail}`);
  process.exit(1);
}
