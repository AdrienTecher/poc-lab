import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { defineConfig } from "vite";

// base: "./" is only the local-dev fallback (pnpm dev / a lone `vite build`).
// The build orchestrator (scripts/build.mjs) injects the real, absolute Pages
// path via `--base /poc-lab/<slug>/`, which overrides this.

/** Everything copied verbatim out of public/ that has to be offline too. */
const STATIC = [
  "manifest.webmanifest",
  "fonts/fredoka-var.woff2",
  "fonts/plex-mono-400.woff2",
  "fonts/plex-mono-500.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
];

/**
 * Emit the service worker with its precache list filled in.
 *
 * It cannot live in public/ — those files are copied verbatim, and what it needs is
 * a list of vite's own CONTENT-HASHED output, which does not exist until the bundle
 * does. So the template is read here and emitted as a bundle asset instead.
 *
 * The cache name is a hash of that list, so it changes exactly when the build does:
 * a deploy invalidates the old cache by construction, rather than by somebody
 * remembering to bump a number, which is how hand-written service workers go stale.
 */
const serviceWorker = () => {
  let base = "/";
  return {
    name: "nuage-service-worker",
    apply: "build",
    configResolved(config) { base = config.base; },
    generateBundle(_options, bundle) {
      const emitted = Object.keys(bundle).filter((f) => !f.endsWith(".map"));
      // the navigation fallback has to be first: sw.js reaches for PRECACHE[0] when
      // an offline navigation misses
      const precache = [base, ...emitted.map((f) => base + f), ...STATIC.map((f) => base + f)];
      // Hash the CONTENT of the public files, not just their names. Vite content-
      // hashes the JS and CSS filenames, so those bust the cache by being renamed —
      // but manifest.webmanifest, the icons and the fonts keep stable names forever,
      // so a changed icon would have been served from the old cache indefinitely.
      const pub = new URL("./public/", import.meta.url);
      const contents = STATIC.map((f) => createHash("sha256").update(readFileSync(new URL(f, pub))).digest("hex"));
      const version = createHash("sha256")
        .update([...precache, ...contents].join("|")).digest("hex").slice(0, 12);
      const source = readFileSync(new URL("./sw.template.js", import.meta.url), "utf8")
        .replaceAll("__PRECACHE__", JSON.stringify(precache, null, 2))
        .replaceAll("__VERSION__", version);
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
};

export default defineConfig({
  base: "./",
  plugins: [serviceWorker()],
  build: { outDir: "dist", emptyOutDir: true },
});
