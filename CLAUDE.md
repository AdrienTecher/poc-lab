# poc-lab — operating manual

Public gallery of self-contained SPAs generated with Claude, published to GitHub
Pages at **https://adrientecher.github.io/poc-lab/**. Each app is a folder under
`apps/<slug>/`; the folder existing *is* its registration — there is **no central
list to edit** when adding one.

## 1. How it works

| signal | kind | pipeline |
|---|---|---|
| `apps/<slug>/index.html` (+ assets), no `package.json` | **static** | copied verbatim → `dist/<slug>/` |
| `apps/<slug>/package.json` present | **buildable** | Vite build (base `/poc-lab/<slug>/`) → `dist/<slug>/` |

- `scripts/build.mjs` — orchestrator: per app, build or copy into `dist/`, write `.nojekyll`, then generate the gallery.
- `scripts/gallery.mjs` — writes `dist/index.html` + `dist/apps.json` from each app's `meta.json` (falling back to its `<title>`/`<meta description>`).
- `scripts/validate.mjs` — gates every `apps/<slug>/meta.json` against `schema/app.schema.json` (runs as `prebuild` and in CI).
- `.github/workflows/deploy.yml` — validate → build → deploy to Pages on push to `main`.

## 2. Adding an app

`node scripts/new-app.mjs <slug> [--kind buildable]`, drop the downloaded artifact
in, edit `apps/<slug>/meta.json`, then `pnpm build` to preview. See the README's
"Add an artifact" section.

## 3. Conventions (vendored from adrien-atelier, imported below)

- Commits: **Conventional Commits**, **never a `Co-Authored-By` trailer, never any AI/agent mention**.
- **Local-first**: commit freely; **push and deploy require explicit approval**.
- Bilingual policy: **English** for code, docs, and commits; **French** for the
  outward-facing gallery copy, with English alongside.
- Metadata favours **explicit configuration over convention** — `meta.json` and
  `site.json` are declared, not inferred.

@.claude/atelier/conventions/git.md
@.claude/atelier/conventions/prose.md
@.claude/atelier/conventions/tooling.md
@.claude/atelier/design/visual-taste.md
@.claude/atelier/identity/taste.md
