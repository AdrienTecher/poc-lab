// Build orchestrator. For each folder under apps/:
//   - buildable (has package.json): run Vite with base=<SITE>/<slug>/, copy output to dist/<slug>/
//   - static (no package.json):     copy the folder verbatim to dist/<slug>/ (minus node_modules/meta.json)
// Then write dist/.nojekyll and generate the gallery. Uses only node built-ins (+ pnpm/vite for buildable apps).
//
// SITE is the Pages base path. Default "/poc-lab" (production). `pnpm preview` sets SITE=""
// so buildable apps build root-relative and dist/ can be served from localhost root.
import { rm, mkdir, cp, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGallery } from "./gallery.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPS = join(ROOT, "apps");
const DIST = join(ROOT, "dist");
const SITE = process.env.SITE ?? "/poc-lab";

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

const slugs = existsSync(APPS)
  ? (await readdir(APPS, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  : [];

const built = [];
for (const slug of slugs) {
  const appDir = join(APPS, slug);
  const outDir = join(DIST, slug);

  if (existsSync(join(appDir, "package.json"))) {
    const base = `${SITE}/${slug}/`;
    console.log(`build: vite ${slug} (base=${base})`);
    const r = spawnSync("pnpm", ["exec", "vite", "build", "--base", base, "--outDir", "dist", "--emptyOutDir"], {
      cwd: appDir,
      stdio: "inherit",
    });
    if (r.status !== 0) {
      console.error(`build: FAILED — vite build for ${slug} exited ${r.status}`);
      process.exit(1);
    }
    await cp(join(appDir, "dist"), outDir, { recursive: true });
    built.push({ slug, kind: "buildable" });
  } else {
    console.log(`build: copy ${slug} (static)`);
    await cp(appDir, outDir, {
      recursive: true,
      // rel is "" for appDir itself, "/index.html", "/fonts/x.woff2", "/meta.json", "/node_modules/…"
      filter: (src) => {
        const rel = src.slice(appDir.length);
        return rel !== "/meta.json" && !rel.startsWith("/node_modules");
      },
    });
    built.push({ slug, kind: "static" });
  }
}

await writeFile(join(DIST, ".nojekyll"), "");
await buildGallery({ root: ROOT, dist: DIST, apps: built });
console.log(`build: done — ${built.length} app(s) -> dist/`);
