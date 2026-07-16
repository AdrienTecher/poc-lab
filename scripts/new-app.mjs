// Scaffold a new app folder for an artifact downloaded from claude.ai.
//   node scripts/new-app.mjs <slug> [--kind static|buildable] [--title "..."]
// static:    creates apps/<slug>/index.html stub + meta.json
// buildable: copies templates/vite-react into apps/<slug>/ (renaming the package) + meta.json
import { existsSync, mkdirSync, writeFileSync, cpSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const slug = argv[0];
const flag = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

const usage = 'usage: node scripts/new-app.mjs <slug> [--kind static|buildable] [--title "..."]';
if (!slug || slug.startsWith("--")) {
  console.error(usage);
  process.exit(1);
}
if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
  console.error(`error: slug "${slug}" must match ^[a-z][a-z0-9-]*$ (kebab-case)`);
  process.exit(1);
}

const kind = flag("--kind", "static");
if (!["static", "buildable"].includes(kind)) {
  console.error("error: --kind must be 'static' or 'buildable'");
  process.exit(1);
}

const appDir = join(ROOT, "apps", slug);
if (existsSync(appDir)) {
  console.error(`error: apps/${slug} already exists`);
  process.exit(1);
}

const title = flag("--title", slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
const today = new Date().toISOString().slice(0, 10);

mkdirSync(appDir, { recursive: true });

if (kind === "buildable") {
  cpSync(join(ROOT, "templates", "vite-react"), appDir, { recursive: true });
  // Give the workspace package a unique name so pnpm doesn't see a duplicate.
  const pkgPath = join(appDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.name = `@poc-lab/${slug}`;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
} else {
  writeFileSync(
    join(appDir, "index.html"),
    `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body>
  <!-- Replace this file with the artifact downloaded from claude.ai. -->
  <main style="font-family: system-ui, sans-serif; padding: 2rem;">
    <h1>${title}</h1>
    <p>Remplacer ce fichier par l'artefact téléchargé depuis claude.ai.</p>
  </main>
</body>
</html>
`,
  );
}

writeFileSync(
  join(appDir, "meta.json"),
  JSON.stringify({ slug, title, description: "", tags: [], created: today, source: "claude.ai", kind }, null, 2) + "\n",
);

console.log(`created apps/${slug} (${kind}).`);
console.log(
  kind === "buildable"
    ? `next: put the artifact component in apps/${slug}/src/App.jsx, add any deps (e.g. recharts) to package.json, then \`pnpm install && pnpm build\`.`
    : `next: replace apps/${slug}/index.html with the downloaded artifact, edit apps/${slug}/meta.json, then \`pnpm build\`.`,
);
