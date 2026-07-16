# poc-lab

A public gallery of small, self-contained single-page apps generated with Claude,
published to **GitHub Pages** at **https://adrientecher.github.io/poc-lab/**.

Each app lives in its own folder under [`apps/`](apps/). A build step copies the
static ones, builds the React ones with Vite, and generates a landing-page gallery
from the folders themselves — **there is no central list to maintain**.

## Layout

```
apps/<slug>/                 one app = one folder
  index.html                 static app (single or multi-file), served verbatim
  meta.json                  optional metadata override (title, description, tags…)
  package.json               presence marks a BUILDABLE app (built with Vite)
scripts/                     build.mjs · gallery.mjs · validate.mjs · new-app.mjs
schema/app.schema.json       JSON Schema for meta.json (validated in CI)
templates/vite-react/        scaffold copied when adding a buildable app
site.json                    gallery title / taglines
.github/workflows/deploy.yml validate → build → deploy on push to main
```

Two app kinds, distinguished by one signal:

| `apps/<slug>/` contains | kind | what the build does |
| --- | --- | --- |
| just `index.html` (+ assets) | **static** | copies the folder to `dist/<slug>/` |
| a `package.json` | **buildable** | runs `vite build --base /poc-lab/<slug>/` → `dist/<slug>/` |

## Local development

Requires Node ≥ 22 and pnpm 9.9.0 (pinned via the `packageManager` field; use
[corepack](https://nodejs.org/api/corepack.html) to match it).

```bash
pnpm install
pnpm build      # validate + build the whole site into dist/
pnpm preview    # build root-relative and serve dist/ at http://localhost:4173
pnpm validate   # just re-check every meta.json against the schema
```

`dist/` is the deployable artifact and is git-ignored — CI rebuilds it.

## Add an artifact

Every folder under `apps/` becomes a card automatically. You never edit a central list.

1. **Download** the artifact from the claude.ai chat (the download button on the
   artifact panel).
2. **Scaffold:** `pnpm new-app <slug>` (kebab-case, e.g. `orbital-sim`). Add
   `--kind buildable` for a React / multi-file artifact.
3. **Drop it in:**
   - single-file HTML → replace `apps/<slug>/index.html`;
   - React component → put it in `apps/<slug>/src/App.jsx` (rendered by `src/main.jsx`),
     and add any dependencies (e.g. `recharts`) to that app's `package.json`;
   - a zip / multi-file bundle → unzip into `apps/<slug>/` (it's static unless it has a `package.json`).
4. **Describe it:** edit `apps/<slug>/meta.json` — `title`, `description`, `tags`.
   Set `"featured": true` to pin it to the top, `"hidden": true` to stage without publishing.
   `meta.json` is optional; without it the title/description are read from the artifact's
   `<title>` and `<meta name="description">`.
5. **Preview:** `pnpm build`, then open `dist/index.html` (or `pnpm preview`).
6. **Ship:** commit and push `main`; CI validates, builds, and deploys.

## Deploy

Deployment is automated via GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)):
`validate → build → upload-pages-artifact → deploy-pages`. It requires the repo's
Pages **source** to be set to *GitHub Actions* (one-time, in repo Settings → Pages,
or `gh api -X POST /repos/AdrienTecher/poc-lab/pages -f build_type=workflow`).

## Conventions

Development conventions are vendored from `adrien-atelier` under
[`.claude/atelier/`](.claude/atelier/) and summarized in [`CLAUDE.md`](CLAUDE.md).
In short: Conventional Commits (no AI/co-author trailers), local-first with
push/deploy gated on explicit approval, English for code and docs, French for the
outward-facing gallery.

## License

All rights reserved. The site is published for viewing; its content is not
licensed for reuse.
