// Validate every apps/<slug>/meta.json against schema/app.schema.json.
// meta.json is optional; a folder without one is valid. Exits non-zero on any
// problem (the "linter-as-tool" pattern), so CI fails loudly before a build.
import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPS = join(ROOT, "apps");
const SCHEMA = join(ROOT, "schema", "app.schema.json");

const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile(JSON.parse(readFileSync(SCHEMA, "utf8")));

const slugs = existsSync(APPS)
  ? readdirSync(APPS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];

const problems = [];
let checked = 0;

for (const slug of slugs) {
  const metaPath = join(APPS, slug, "meta.json");
  if (!existsSync(metaPath)) continue; // meta.json is an optional override
  checked++;

  let meta;
  try {
    meta = JSON.parse(readFileSync(metaPath, "utf8"));
  } catch (err) {
    problems.push(`apps/${slug}/meta.json: invalid JSON — ${err.message}`);
    continue;
  }

  if (!validate(meta)) {
    for (const e of validate.errors) {
      problems.push(`apps/${slug}/meta.json ${e.instancePath || "/"}: ${e.message}`);
    }
  }
  if (meta.slug !== undefined && meta.slug !== slug) {
    problems.push(`apps/${slug}/meta.json: slug "${meta.slug}" must equal folder name "${slug}"`);
  }
}

if (problems.length > 0) {
  console.error(`validate: FAILED — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`validate: OK — ${slugs.length} app(s), ${checked} meta.json checked`);
