// Generate the gallery landing page (dist/index.html) + a derived registry
// (dist/apps.json) from the built apps, and copy the page's own font assets.
//
// Per-app metadata resolution, first hit wins:
//   title       meta.title       -> <title>                     -> Title-Cased slug
//   description meta.description -> <meta name="description">    -> omitted
//   created     meta.created     -> git first-commit date        -> folder mtime
//
// The page is rendered whole, server-side: every app is in the markup, so the
// index works with JavaScript off. The console (search / facets / sort /
// density) is progressive enhancement layered on top of that list — it reorders
// and hides existing nodes, it never fetches or re-renders.
//
// Pure Node built-ins, no dependencies. Every interpolated value is HTML-escaped.
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const decodeEntities = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Search should not care about accents: "erudition" must find "érudition".
const fold = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const extractTitle = (html) => {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : null;
};

const extractDescription = (html) => {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : null;
};

const titleCase = (slug) => slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Stable identity hue per app (djb2 over the slug): survives re-sorting and
// new arrivals, so a card keeps its colour for life.
const slugHue = (slug) => {
  let h = 5381;
  for (let i = 0; i < slug.length; i++) h = ((h * 33) ^ slug.charCodeAt(i)) >>> 0;
  return h % 360;
};

const gitCreated = (root, rel) => {
  try {
    const out = execFileSync("git", ["log", "--diff-filter=A", "--format=%cs", "-1", "--", rel], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
};

// How many tag chips to show before folding the rest behind "more". The tag
// vocabulary has a long tail — most tags name exactly one app — so the rail
// shows the shared ones and search covers the singletons.
const FACETS_SHOWN = 10;

export async function buildGallery({ root, dist, apps }) {
  const site = existsSync(join(root, "site.json")) ? JSON.parse(readFileSync(join(root, "site.json"), "utf8")) : {};

  const records = [];
  for (const { slug, kind } of apps) {
    const built = join(dist, slug, "index.html");
    if (!existsSync(built)) {
      console.warn(`gallery: skip ${slug} (no dist/${slug}/index.html)`);
      continue;
    }
    const metaPath = join(root, "apps", slug, "meta.json");
    const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : {};
    if (meta.hidden) continue;

    const html = readFileSync(built, "utf8");
    records.push({
      slug,
      title: meta.title ?? extractTitle(html) ?? titleCase(slug),
      description: meta.description ?? extractDescription(html) ?? "",
      description_en: meta.description_en ?? "",
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      created:
        meta.created ??
        gitCreated(root, join("apps", slug)) ??
        statSync(join(root, "apps", slug)).mtime.toISOString().slice(0, 10),
      source: meta.source ?? "claude.ai",
      kind: meta.kind ?? kind,
      featured: meta.featured ?? false,
      hue: slugHue(slug),
    });
  }

  // featured first, then newest, then alphabetical
  records.sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      b.created.localeCompare(a.created) ||
      a.title.localeCompare(b.title),
  );

  const facets = tagFacets(records);
  copyAssets(root, dist);

  writeFileSync(
    join(dist, "apps.json"),
    JSON.stringify({ version: 1, count: records.length, entries: records }, null, 2) + "\n",
  );
  writeFileSync(join(dist, "index.html"), renderPage(records, site, facets));
  console.log(`gallery: ${records.length} app(s), ${facets.length} tag(s) -> dist/index.html`);
  return records;
}

// Tags ranked by how many apps share them, then alphabetically. Shared tags are
// the ones worth a chip; the singletons stay reachable through search.
function tagFacets(records) {
  const counts = new Map();
  for (const r of records) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }));
}

function copyAssets(root, dist) {
  const from = join(root, "assets", "fonts");
  if (!existsSync(from)) return;
  const to = join(dist, "assets", "fonts");
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from)) copyFileSync(join(from, f), join(to, f));
}

function renderApp(app, i) {
  const title = esc(app.title);
  const haystack = esc(fold([app.title, app.description, app.description_en, app.slug, ...app.tags].join(" ")));
  const descFr = app.description ? `<p class="app__fr">${esc(app.description)}</p>` : "";
  const descEn = app.description_en ? `<p class="app__en" lang="en">${esc(app.description_en)}</p>` : "";
  const featured = app.featured ? `<span class="app__star" title="À la une" aria-label="À la une"></span>` : "";
  const tags = app.tags.length
    ? `<ul class="app__tags">${app.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
    : "";
  return `        <a class="app" href="./${esc(app.slug)}/"
           style="--h:${app.hue};--i:${i}"
           data-slug="${esc(app.slug)}"
           data-tags="${esc(app.tags.join(" "))}"
           data-date="${esc(app.created)}"
           data-title="${esc(fold(app.title))}"
           data-text="${haystack}">
          <span class="app__rail" aria-hidden="true"></span>
          <div class="app__head">
            <span class="app__dot" aria-hidden="true"></span>
            <h2 class="app__title">${title}</h2>
            ${featured}
            <time datetime="${esc(app.created)}">${esc(app.created)}</time>
          </div>
          ${descFr}
          ${descEn}
          <div class="app__foot">
            ${tags}
            <span class="app__go" aria-hidden="true">Ouvrir<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
          </div>
        </a>`;
}

function renderPage(apps, site, facets) {
  const title = esc(site.title ?? "POC Lab");
  const taglineFr = esc(site.tagline_fr ?? "");
  const taglineEn = esc(site.tagline_en ?? "");
  const repo = site.repo ? esc(site.repo) : "";
  const n = apps.length;
  // Density that suits the shelf you actually have: cards while the collection
  // is browsable in one look, the index once it is a catalogue. Overridable,
  // and the override is remembered.
  const defaultDensity = n > 24 ? "index" : "cards";

  const list = apps.length
    ? apps.map(renderApp).join("\n")
    : `        <p class="empty-init">Les premiers ateliers arrivent bientôt.<span lang="en">First experiments coming soon.</span></p>`;

  // One segment per app, in gallery order, each in the app's identity hue: the
  // colour system of the grid condensed into a strip. It dims with the filter,
  // so it doubles as a readout of how much of the collection you are looking at.
  const spectrum = apps.length
    ? `<div class="spectrum" id="spectrum" aria-hidden="true">${apps
        .map((a) => `<span style="--h:${a.hue}" data-slug="${esc(a.slug)}" title="${esc(a.title)}"></span>`)
        .join("")}</div>`
    : "";

  const chips = facets
    .map(
      (f, i) =>
        `<button class="facet${i >= FACETS_SHOWN ? " facet--extra" : ""}" type="button" data-tag="${esc(f.tag)}" aria-pressed="false">${esc(
          f.tag,
        )}<span class="facet__n">${f.count}</span></button>`,
    )
    .join("");
  const moreBtn =
    facets.length > FACETS_SHOWN
      ? `<button class="facet facet--more" id="more" type="button" aria-expanded="false">+${facets.length - FACETS_SHOWN}</button>`
      : "";

  const sun = `<svg class="icon icon-sun" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
  const moon = `<svg class="icon icon-moon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
  const github = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`;
  const glass = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>`;
  const dice = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="8.6" cy="8.6" r="1.35" fill="currentColor" stroke="none"/><circle cx="15.4" cy="15.4" r="1.35" fill="currentColor" stroke="none"/><circle cx="15.4" cy="8.6" r="1.35" fill="currentColor" stroke="none"/></svg>`;
  const gridIcon = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>`;
  const rowsIcon = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4 6.5h16M4 12h16M4 17.5h16"/></svg>`;

  return `<!doctype html>
<html lang="${esc(site.lang ?? "fr")}" data-density="${defaultDensity}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${taglineFr}" />
  <meta name="color-scheme" content="light dark" />
  <style>
    /* Self-hosted and subsetted; the page makes no external request. */
    @font-face { font-family: "Space Grotesk"; font-style: normal; font-weight: 500; font-display: swap; src: url("assets/fonts/space-grotesk-500.woff2") format("woff2"); }
    @font-face { font-family: "Space Grotesk"; font-style: normal; font-weight: 700; font-display: swap; src: url("assets/fonts/space-grotesk-700.woff2") format("woff2"); }
    @font-face { font-family: "IBM Plex Mono"; font-style: normal; font-weight: 400; font-display: swap; src: url("assets/fonts/plex-mono-400.woff2") format("woff2"); }
    @font-face { font-family: "IBM Plex Mono"; font-style: normal; font-weight: 500; font-display: swap; src: url("assets/fonts/plex-mono-500.woff2") format("woff2"); }

    :root {
      color-scheme: light dark;
      --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --font-display: "Space Grotesk", var(--font-sans);
      --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", "Menlo", monospace;
      --step--1: clamp(0.78rem, 0.75rem + 0.1vw, 0.84rem);
      --step-0: clamp(0.94rem, 0.9rem + 0.2vw, 1rem);
      --step-1: clamp(1.05rem, 0.98rem + 0.35vw, 1.22rem);
      --step-2: clamp(2.3rem, 1.7rem + 2.6vw, 3.8rem);
      --sp-1: 0.25rem; --sp-2: 0.5rem; --sp-3: 0.75rem; --sp-4: 1rem; --sp-6: 1.5rem; --sp-8: 2rem; --sp-12: 3rem;
      --radius: 16px; --maxw: 1180px;
      --bg: #faf9f6; --surface: #ffffff; --surface-2: #f1efe9; --border: #e6e2d9;
      --text: #1a1916; --muted: #6d6a61; --dot: rgba(26, 25, 22, 0.055);
      --accent-l: 52%; --accent-c: 0.13; --rail-l: 62%; --rail-c: 0.16;
      --shadow: 0 1px 2px rgba(24, 22, 18, 0.05), 0 1px 1px rgba(24, 22, 18, 0.04);
      --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
    }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
        --bg: #0f0f12; --surface: #17171c; --surface-2: #1f1f26; --border: #2b2b34;
        --text: #f0efea; --muted: #9d9b93; --dot: rgba(240, 239, 234, 0.05);
        --accent-l: 76%; --accent-c: 0.11; --rail-l: 70%; --rail-c: 0.14;
        --shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      }
    }
    :root[data-theme="dark"] {
      --bg: #0f0f12; --surface: #17171c; --surface-2: #1f1f26; --border: #2b2b34;
      --text: #f0efea; --muted: #9d9b93; --dot: rgba(240, 239, 234, 0.05);
      --accent-l: 76%; --accent-c: 0.11; --rail-l: 70%; --rail-c: 0.14;
      --shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    }

    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
    body {
      margin: 0; background: var(--bg); color: var(--text);
      background-image: radial-gradient(var(--dot) 1px, transparent 1px);
      background-size: 24px 24px;
      font-family: var(--font-sans); font-size: var(--step-0); line-height: 1.55;
      -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
      min-height: 100vh;
    }
    body::before {
      content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none;
      background:
        radial-gradient(58vw 40vw at 88% -12%, oklch(70% 0.08 285 / 0.12), transparent 62%),
        radial-gradient(48vw 36vw at -8% 104%, oklch(74% 0.07 165 / 0.10), transparent 62%);
    }
    .wrap { max-width: var(--maxw); margin-inline: auto; padding: clamp(1.5rem, 5vw, 4rem) clamp(1.1rem, 4vw, 2rem) var(--sp-8); }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

    /* ── masthead ───────────────────────────────────────────────────── */
    header.masthead { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-4); }
    .brand { display: flex; flex-direction: column; gap: var(--sp-3); min-width: 0; }
    .eyebrow { font-family: var(--font-mono); font-size: var(--step--1); letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }
    .eyebrow b { font-weight: 500; color: var(--text); }
    h1 { margin: 0; font-family: var(--font-display); font-size: var(--step-2); font-weight: 700; letter-spacing: -0.035em; line-height: 0.98; }
    .tagline { margin: 0; color: var(--muted); max-width: 52ch; text-wrap: balance; }
    .tagline .en { display: block; font-size: var(--step--1); opacity: 0.8; margin-top: 0.15em; }
    .masthead__actions { flex: none; display: flex; gap: var(--sp-2); }
    .iconbtn {
      display: grid; place-items: center; width: 38px; height: 38px;
      border: 1px solid var(--border); border-radius: 11px; background: var(--surface);
      color: var(--text); cursor: pointer; box-shadow: var(--shadow); text-decoration: none;
      transition: border-color 0.18s ease, transform 0.18s ease;
    }
    .iconbtn:hover { border-color: color-mix(in oklab, var(--text) 35%, var(--border)); transform: translateY(-1px); }
    .icon-moon { display: none; }
    @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .icon-sun { display: none; } :root:not([data-theme="light"]) .icon-moon { display: inline; } }
    :root[data-theme="dark"] .icon-sun { display: none; } :root[data-theme="dark"] .icon-moon { display: inline; }
    :root[data-theme="light"] .icon-sun { display: inline; } :root[data-theme="light"] .icon-moon { display: none; }

    /* ── spectrum: the whole collection as one strip ─────────────────── */
    /* min-width:0 lets segments shrink as the collection grows; overflow:hidden
       is the hard guarantee that the strip can never widen the page, whatever
       the app count reaches. */
    .spectrum { display: flex; gap: 2px; height: 5px; margin: var(--sp-6) 0 0; overflow: hidden; }
    @media (max-width: 560px) { .spectrum { gap: 1px; } }
    .spectrum span {
      flex: 1 1 0; min-width: 0; border-radius: 99px;
      background: oklch(var(--rail-l) var(--rail-c) var(--h));
      transition: opacity 0.28s var(--ease), transform 0.28s var(--ease);
      transform-origin: bottom;
    }
    .spectrum span.is-out { opacity: 0.16; transform: scaleY(0.5); }
    .spectrum span.is-lit { transform: scaleY(2.2); }

    /* ── console: search, sort, density ─────────────────────────────── */
    .console {
      position: sticky; top: 0; z-index: 20;
      display: flex; flex-wrap: wrap; gap: var(--sp-2);
      margin: var(--sp-6) 0 var(--sp-4); padding: var(--sp-3) 0;
      background: color-mix(in oklab, var(--bg) 88%, transparent);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    }
    .search { position: relative; flex: 1 1 260px; display: flex; align-items: center; }
    .search svg { position: absolute; left: 13px; color: var(--muted); pointer-events: none; }
    .search input {
      width: 100%; font: inherit; color: var(--text);
      padding: 0.62rem 3.2rem 0.62rem 2.5rem;
      background: var(--surface); border: 1px solid var(--border); border-radius: 11px;
      box-shadow: var(--shadow); transition: border-color 0.18s ease;
      -webkit-appearance: none; appearance: none;
    }
    .search input::-webkit-search-cancel-button { -webkit-appearance: none; }
    .search input:focus { outline: none; border-color: color-mix(in oklab, var(--text) 42%, var(--border)); }
    .search input::placeholder { color: var(--muted); }
    .search kbd {
      position: absolute; right: 11px; font-family: var(--font-mono); font-size: 0.7rem;
      color: var(--muted); border: 1px solid var(--border); border-bottom-width: 2px;
      border-radius: 5px; padding: 0.05rem 0.35rem; pointer-events: none;
      transition: opacity 0.18s ease;
    }
    .search input:focus ~ kbd, .search input:not(:placeholder-shown) ~ kbd { opacity: 0; }
    .console__tools { display: flex; gap: var(--sp-2); flex: 0 0 auto; }
    .tool {
      display: inline-flex; align-items: center; gap: 0.4em; font: inherit;
      font-size: var(--step--1); color: var(--text); cursor: pointer;
      padding: 0.55rem 0.8rem; background: var(--surface);
      border: 1px solid var(--border); border-radius: 11px; box-shadow: var(--shadow);
      transition: border-color 0.18s ease, transform 0.18s ease, color 0.18s ease;
    }
    .tool:hover { border-color: color-mix(in oklab, var(--text) 35%, var(--border)); transform: translateY(-1px); }
    select.tool { padding-right: 1.6rem; -webkit-appearance: none; appearance: none;
      background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
      background-position: calc(100% - 15px) 55%, calc(100% - 10px) 55%;
      background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; }
    .density { display: inline-flex; background: var(--surface); border: 1px solid var(--border); border-radius: 11px; box-shadow: var(--shadow); overflow: hidden; }
    .density button {
      display: grid; place-items: center; width: 36px; height: 100%; min-height: 38px;
      background: none; border: 0; color: var(--muted); cursor: pointer; transition: color 0.18s ease, background 0.18s ease;
    }
    .density button[aria-pressed="true"] { color: var(--text); background: var(--surface-2); }

    /* ── facets ─────────────────────────────────────────────────────── */
    .facets { display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: center; }
    .facet {
      display: inline-flex; align-items: baseline; gap: 0.4em; font: inherit; font-size: var(--step--1);
      color: var(--muted); background: transparent; border: 1px solid var(--border);
      border-radius: 999px; padding: 0.28rem 0.7rem; cursor: pointer;
      transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease;
    }
    .facet:hover { color: var(--text); border-color: color-mix(in oklab, var(--text) 30%, var(--border)); }
    .facet__n { font-family: var(--font-mono); font-size: 0.68rem; opacity: 0.65; }
    .facet[aria-pressed="true"] { color: var(--text); background: var(--surface-2); border-color: color-mix(in oklab, var(--text) 34%, var(--border)); }
    .facet[aria-pressed="true"] .facet__n { opacity: 0.9; }
    .facet--extra { display: none; }
    .facets.is-open .facet--extra { display: inline-flex; }
    .facets.is-open .facet--more { display: none; }
    .facet--more { font-family: var(--font-mono); }

    /* ── status line ────────────────────────────────────────────────── */
    .status {
      display: flex; align-items: baseline; gap: var(--sp-3); flex-wrap: wrap;
      margin: var(--sp-4) 0 var(--sp-4);
      font-family: var(--font-mono); font-size: var(--step--1); color: var(--muted);
    }
    .status__clear { font: inherit; color: var(--muted); background: none; border: 0; padding: 0; cursor: pointer; border-bottom: 1px solid var(--border); }
    .status__clear:hover { color: var(--text); border-color: currentColor; }
    .status__clear[hidden] { display: none; }

    /* ── results ────────────────────────────────────────────────────── */
    .results { display: grid; gap: var(--sp-4); }
    :root[data-density="cards"] .results { grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: var(--sp-6); }

    .app {
      --accent: oklch(var(--accent-l) var(--accent-c) var(--h));
      --rail: oklch(var(--rail-l) var(--rail-c) var(--h));
      position: relative; overflow: hidden;
      display: flex; flex-direction: column; gap: var(--sp-3);
      padding: var(--sp-6); text-decoration: none; color: inherit;
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      box-shadow: var(--shadow);
      /* Asymmetric: quick to lift, slower to settle, so the card has weight. */
      transition: transform 0.32s var(--ease), box-shadow 0.32s ease, border-color 0.32s ease, background 0.32s ease;
    }
    .app:hover { transition-duration: 0.18s; }
    .app[hidden] { display: none; }
    .app__rail { position: absolute; inset: 0 0 auto 0; height: 3px; background: linear-gradient(90deg, var(--rail), transparent 78%); opacity: 0.65; transition: opacity 0.22s ease; }
    .app:hover { transform: translateY(-3px); border-color: color-mix(in oklab, var(--rail) 50%, var(--border)); box-shadow: 0 18px 40px -18px oklch(var(--rail-l) var(--rail-c) var(--h) / 0.45); }
    .app:hover .app__rail { opacity: 1; }
    .app:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
    .app.is-lit { border-color: var(--rail); box-shadow: 0 18px 40px -18px oklch(var(--rail-l) var(--rail-c) var(--h) / 0.5); }

    .app__head { display: flex; align-items: baseline; gap: var(--sp-2); }
    .app__dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--rail); align-self: center; }
    .app__title { margin: 0; font-family: var(--font-display); font-size: var(--step-1); font-weight: 500; letter-spacing: -0.015em; line-height: 1.2; transition: color 0.22s ease; }
    .app:hover .app__title { color: var(--accent); }
    .app__star { flex: none; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); align-self: center; box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 18%, transparent); }
    .app__head time { margin-left: auto; flex: none; font-family: var(--font-mono); font-size: var(--step--1); color: var(--muted); }
    .app__fr { margin: 0; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .app__en { margin: 0; color: var(--muted); opacity: 0.7; font-size: var(--step--1); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .app__foot { margin-top: auto; padding-top: var(--sp-2); display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-2) var(--sp-3); font-family: var(--font-mono); font-size: var(--step--1); color: var(--muted); }
    .app__tags { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4em; }
    .app__tags li { padding: 0.1em 0.55em; border-radius: 7px; background: var(--surface-2); }
    .app__go { margin-left: auto; display: inline-flex; align-items: center; gap: 0.35em; color: var(--accent); opacity: 0; transform: translateX(-6px); transition: opacity 0.22s ease, transform 0.22s ease; }
    .app:hover .app__go, .app:focus-visible .app__go { opacity: 1; transform: none; }

    /* Index density: same markup, one line per app. Rows are ruled, not boxed —
       a hundred bordered cards stacked 3px apart reads as noise, a hundred ruled
       lines reads as a contents page. */
    :root[data-density="index"] .results { gap: 0; }
    :root[data-density="index"] .app {
      flex-direction: row; align-items: baseline; gap: var(--sp-3);
      padding: 0.5rem var(--sp-3); border-radius: 8px;
      background: transparent; border: 0; border-bottom: 1px solid var(--border);
      box-shadow: none;
    }
    :root[data-density="index"] .app:hover { transform: none; background: var(--surface); border-bottom-color: transparent; box-shadow: var(--shadow); }
    /* A ledger rule every fifth line, so position stays countable down a long
       index without numbering every row. */
    :root[data-density="index"] .app.is-fifth { border-bottom-color: color-mix(in oklab, var(--text) 18%, var(--border)); }
    :root[data-density="index"] .app.is-lit { background: var(--surface); box-shadow: var(--shadow); }
    :root[data-density="index"] .app__rail { inset: 0 auto 0 0; width: 3px; height: auto; border-radius: 3px; background: var(--rail); opacity: 0; }
    :root[data-density="index"] .app:hover .app__rail { opacity: 1; }
    /* min-width, not width: short titles pad out so the descriptions line up in
       a column, long ones are allowed to run past rather than be truncated. */
    :root[data-density="index"] .app__head { flex: 0 1 auto; min-width: 0; gap: var(--sp-2); }
    @media (min-width: 900px) {
      :root[data-density="index"] .app__head { min-width: min(34%, 21rem); }
    }
    :root[data-density="index"] .app__head time { display: none; }
    :root[data-density="index"] .app__title { font-size: var(--step-0); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    :root[data-density="index"] .app__fr { flex: 1 1 12rem; min-width: 0; -webkit-line-clamp: 1; font-size: var(--step--1); }
    :root[data-density="index"] .app__en { display: none; }
    :root[data-density="index"] .app__foot { margin: 0; padding: 0; flex: 0 0 auto; }
    :root[data-density="index"] .app__go { display: none; }
    :root[data-density="index"] .app__tags { flex-wrap: nowrap; }
    :root[data-density="index"] .app__tags li:nth-child(n + 3) { display: none; }
    /* On a phone the index is a list of names, not a list of summaries: the
       description would double every row's height for a clipped half-sentence.
       Card density is where the prose lives. */
    @media (max-width: 720px) {
      :root[data-density="index"] .app { gap: var(--sp-2); }
      :root[data-density="index"] .app__fr { display: none; }
      :root[data-density="index"] .app__foot { margin-left: auto; }
      :root[data-density="index"] .app__tags li:nth-child(n + 2) { display: none; }
    }

    /* Year headers, so a long index stays legible while scrolling. */
    .yr {
      grid-column: 1 / -1; margin: var(--sp-4) 0 0;
      font-family: var(--font-mono); font-size: var(--step--1); letter-spacing: 0.14em;
      text-transform: uppercase; color: var(--muted);
      display: flex; align-items: center; gap: var(--sp-3);
    }
    .yr::after { content: ""; flex: 1; height: 1px; background: var(--border); }
    .yr:first-child { margin-top: 0; }

    .empty, .empty-init { grid-column: 1 / -1; color: var(--muted); text-align: center; padding: var(--sp-12) 0; }
    .empty span, .empty-init span { display: block; font-size: var(--step--1); opacity: 0.8; margin-top: 0.3em; }
    .empty[hidden] { display: none; }

    footer.foot { margin-top: var(--sp-12); padding-top: var(--sp-6); border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: var(--sp-3) var(--sp-6); justify-content: space-between; font-family: var(--font-mono); font-size: var(--step--1); color: var(--muted); }
    footer.foot a { color: var(--muted); text-decoration: none; border-bottom: 1px solid transparent; transition: color 0.18s ease, border-color 0.18s ease; }
    footer.foot a:hover { color: var(--text); border-color: currentColor; }
    .hint { display: none; }
    @media (hover: hover) and (min-width: 720px) { .hint { display: inline; } }
    .hint kbd { font-family: var(--font-mono); border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 4px; padding: 0.02em 0.3em; }

    @media (max-width: 560px) {
      .console { gap: var(--sp-2); }
      .search { flex-basis: 100%; }
      .console__tools { width: 100%; }
      select.tool { flex: 1; }
    }

    @media (prefers-reduced-motion: no-preference) {
      .app { animation: rise 0.5s var(--ease) both; animation-delay: calc(min(var(--i, 0), 12) * 45ms); }
      .brand > * { animation: rise 0.5s var(--ease) both; }
      .brand > *:nth-child(2) { animation-delay: 40ms; }
      .brand > *:nth-child(3) { animation-delay: 80ms; }
      @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      .results.is-filtering .app { animation: pop 0.34s var(--ease) both; animation-delay: calc(min(var(--j, 0), 10) * 22ms); }
      @keyframes pop { from { opacity: 0; transform: scale(0.985) translateY(6px); } to { opacity: 1; transform: none; } }
    }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="masthead">
      <div class="brand">
        <span class="eyebrow">adrientecher · <b>poc-lab</b></span>
        <h1>${title}</h1>
        <p class="tagline">${taglineFr}<span class="en" lang="en">${taglineEn}</span></p>
      </div>
      <div class="masthead__actions">
        ${repo ? `<a class="iconbtn" href="${repo}" aria-label="Code source sur GitHub" title="Code source">${github}</a>` : ""}
        <button id="theme" class="iconbtn" type="button" aria-label="Basculer le thème clair / sombre" title="Thème clair / sombre">${sun}${moon}</button>
      </div>
    </header>

    ${spectrum}

    <div class="console">
      <div class="search">
        ${glass}
        <label class="visually-hidden" for="q">Chercher un atelier</label>
        <input id="q" type="search" placeholder="Chercher — titre, thème, mot-clé…" autocomplete="off" spellcheck="false" />
        <kbd>/</kbd>
      </div>
      <div class="console__tools">
        <button class="tool" id="rand" type="button" title="Ouvrir un atelier au hasard">${dice}<span>Au hasard</span></button>
        <label class="visually-hidden" for="sort">Trier</label>
        <select class="tool" id="sort">
          <option value="recent">Plus récents</option>
          <option value="old">Plus anciens</option>
          <option value="az">A → Z</option>
        </select>
        <div class="density" role="group" aria-label="Densité d'affichage">
          <button id="d-cards" type="button" aria-pressed="false" aria-label="Vue en cartes" title="Cartes">${gridIcon}</button>
          <button id="d-index" type="button" aria-pressed="false" aria-label="Vue en index" title="Index">${rowsIcon}</button>
        </div>
      </div>
    </div>

    <div class="facets" id="facets">${chips}${moreBtn}</div>

    <p class="status"><span id="count" aria-live="polite"></span><button class="status__clear" id="clear" type="button" hidden>tout effacer</button></p>

    <main class="results" id="results">
${list}
    </main>
    <p class="empty" id="empty" hidden>Aucun atelier ne correspond.<span lang="en">No experiment matches that.</span></p>

    <footer class="foot">
      <span>${n} atelier${n > 1 ? "s" : ""} · fait${n > 1 ? "s" : ""} avec Claude <span class="hint">· <kbd>/</kbd> chercher · <kbd>r</kbd> au hasard</span></span>
      ${repo ? `<a href="${repo}">github.com/AdrienTecher/poc-lab</a>` : ""}
    </footer>
  </div>

  <script>
    (function () {
      "use strict";
      var root = document.documentElement;
      var THEME_KEY = "poc-lab-theme";
      var DENSITY_KEY = "poc-lab-density";

      // ── theme ────────────────────────────────────────────────────
      try { var savedTheme = localStorage.getItem(THEME_KEY); if (savedTheme) root.dataset.theme = savedTheme; } catch (e) {}
      var themeBtn = document.getElementById("theme");
      if (themeBtn) themeBtn.addEventListener("click", function () {
        var sysDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        var cur = root.dataset.theme || (sysDark ? "dark" : "light");
        root.dataset.theme = cur === "dark" ? "light" : "dark";
        try { localStorage.setItem(THEME_KEY, root.dataset.theme); } catch (e) {}
      });

      var results = document.getElementById("results");
      if (!results) return;
      var apps = [].slice.call(results.querySelectorAll(".app"));
      if (!apps.length) return;

      var q = document.getElementById("q");
      var sortSel = document.getElementById("sort");
      var facetsBox = document.getElementById("facets");
      var countEl = document.getElementById("count");
      var clearBtn = document.getElementById("clear");
      var emptyEl = document.getElementById("empty");
      var spectrum = document.getElementById("spectrum");
      var segs = spectrum ? [].slice.call(spectrum.children) : [];
      var segBySlug = {};
      segs.forEach(function (s) { segBySlug[s.dataset.slug] = s; });
      var appBySlug = {};
      apps.forEach(function (a) { appBySlug[a.dataset.slug] = a; });

      var model = apps.map(function (el) {
        return {
          el: el,
          slug: el.dataset.slug,
          text: el.dataset.text || "",
          title: el.dataset.title || "",
          date: el.dataset.date || "",
          tags: (el.dataset.tags || "").split(" ").filter(Boolean),
        };
      });

      var state = { q: "", tags: [], sort: "recent" };
      // The server picked a density from the app count. Remember it, so we can
      // tell "the page chose this" from "the reader chose this" and only ever
      // persist or link the latter.
      var serverDensity = root.dataset.density === "index" ? "index" : "cards";

      var fold = function (s) {
        return String(s).normalize ? String(s).normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase() : String(s).toLowerCase();
      };

      // ── url state: every view is a link someone can send ──────────
      function readUrl() {
        var p = new URLSearchParams(location.search);
        state.q = p.get("q") || "";
        state.tags = p.getAll("tag");
        state.sort = ["recent", "old", "az"].indexOf(p.get("sort")) >= 0 ? p.get("sort") : "recent";
        var d = p.get("view");
        if (d !== "cards" && d !== "index") { try { d = localStorage.getItem(DENSITY_KEY); } catch (e) { d = null; } }
        if (d === "cards" || d === "index") root.dataset.density = d;
      }
      function writeUrl() {
        var p = new URLSearchParams();
        if (state.q) p.set("q", state.q);
        state.tags.forEach(function (t) { p.append("tag", t); });
        if (state.sort !== "recent") p.set("sort", state.sort);
        if (root.dataset.density !== serverDensity) p.set("view", root.dataset.density);
        var s = p.toString();
        history.replaceState(null, "", s ? "?" + s : location.pathname);
      }

      function matches(m) {
        for (var i = 0; i < state.tags.length; i++) if (m.tags.indexOf(state.tags[i]) < 0) return false;
        if (!state.q) return true;
        var needles = fold(state.q).split(/\\s+/).filter(Boolean);
        for (var j = 0; j < needles.length; j++) if (m.text.indexOf(needles[j]) < 0) return false;
        return true;
      }

      var yearNodes = [];
      function apply(animate) {
        var kept = model.filter(matches);
        kept.sort(function (a, b) {
          if (state.sort === "az") return a.title.localeCompare(b.title);
          if (state.sort === "old") return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
          return b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
        });

        yearNodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
        yearNodes = [];
        apps.forEach(function (el) { el.hidden = true; });

        // One reflow: append the survivors in order, inserting year rules when
        // the sort is chronological and the list is long enough to need them.
        var frag = document.createDocumentFragment();
        var showYears = state.sort !== "az" && kept.length > 12;
        var lastYear = null;
        kept.forEach(function (m, i) {
          if (showYears) {
            var y = m.date.slice(0, 4);
            if (y !== lastYear) {
              lastYear = y;
              var h = document.createElement("p");
              h.className = "yr";
              h.textContent = y;
              yearNodes.push(h);
              frag.appendChild(h);
            }
          }
          m.el.hidden = false;
          m.el.style.setProperty("--j", i);
          // Ledger rule counts visible rows, not DOM children — the container
          // also holds the year rules and every filtered-out row.
          m.el.classList.toggle("is-fifth", (i + 1) % 5 === 0);
          frag.appendChild(m.el);
        });
        results.appendChild(frag);

        // Only choreograph a set small enough to read as choreography. Staggering
        // a hundred rows is invisible as motion and merely costly, so past that
        // the list simply appears.
        results.classList.remove("is-filtering");
        if (animate && kept.length <= 30) {
          void results.offsetWidth;
          results.classList.add("is-filtering");
        }

        var keptSlugs = {};
        kept.forEach(function (m) { keptSlugs[m.slug] = 1; });
        segs.forEach(function (s) { s.classList.toggle("is-out", !keptSlugs[s.dataset.slug]); });

        var total = model.length;
        countEl.textContent = kept.length === total
          ? total + (total > 1 ? " ateliers" : " atelier")
          : kept.length + " / " + total;
        emptyEl.hidden = kept.length !== 0;
        var dirty = !!state.q || state.tags.length > 0;
        clearBtn.hidden = !dirty;
        [].slice.call(facetsBox.querySelectorAll(".facet[data-tag]")).forEach(function (b) {
          b.setAttribute("aria-pressed", state.tags.indexOf(b.dataset.tag) >= 0 ? "true" : "false");
        });
        if (q.value !== state.q) q.value = state.q;
        sortSel.value = state.sort;
      }

      // ── wiring ───────────────────────────────────────────────────
      var t = null;
      q.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () { state.q = q.value.trim(); writeUrl(); apply(true); }, 90);
      });
      q.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { q.value = ""; state.q = ""; writeUrl(); apply(true); q.blur(); }
      });

      facetsBox.addEventListener("click", function (e) {
        var more = e.target.closest("#more");
        if (more) { facetsBox.classList.add("is-open"); more.setAttribute("aria-expanded", "true"); return; }
        var btn = e.target.closest(".facet[data-tag]");
        if (!btn) return;
        var tag = btn.dataset.tag;
        var at = state.tags.indexOf(tag);
        if (at >= 0) state.tags.splice(at, 1); else state.tags.push(tag);
        writeUrl(); apply(true);
      });

      sortSel.addEventListener("change", function () { state.sort = sortSel.value; writeUrl(); apply(true); });
      clearBtn.addEventListener("click", function () { state.q = ""; state.tags = []; q.value = ""; writeUrl(); apply(true); });

      function reflectDensity(d) {
        root.dataset.density = d;
        document.getElementById("d-cards").setAttribute("aria-pressed", d === "cards" ? "true" : "false");
        document.getElementById("d-index").setAttribute("aria-pressed", d === "index" ? "true" : "false");
      }
      function chooseDensity(d) {
        reflectDensity(d);
        try { localStorage.setItem(DENSITY_KEY, d); } catch (e) {}
        writeUrl();
      }
      document.getElementById("d-cards").addEventListener("click", function () { chooseDensity("cards"); });
      document.getElementById("d-index").addEventListener("click", function () { chooseDensity("index"); });

      // Serendipity: open one of whatever is currently on screen.
      document.getElementById("rand").addEventListener("click", function () {
        var pool = model.filter(function (m) { return !m.el.hidden; });
        if (pool.length) location.href = pool[Math.floor(Math.random() * pool.length)].el.getAttribute("href");
      });

      // Hovering a spectrum segment lights its app, so the strip reads as a map.
      segs.forEach(function (s) {
        s.addEventListener("mouseenter", function () {
          var a = appBySlug[s.dataset.slug];
          if (!a || a.hidden) return;
          s.classList.add("is-lit"); a.classList.add("is-lit");
        });
        s.addEventListener("mouseleave", function () {
          var a = appBySlug[s.dataset.slug];
          s.classList.remove("is-lit"); if (a) a.classList.remove("is-lit");
        });
      });

      document.addEventListener("keydown", function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        var tag = (e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "select" || tag === "textarea") return;
        if (e.key === "/") { e.preventDefault(); q.focus(); q.select(); }
        else if (e.key === "r" || e.key === "R") { e.preventDefault(); document.getElementById("rand").click(); }
      });

      window.addEventListener("popstate", function () { readUrl(); apply(true); });

      readUrl();
      reflectDensity(root.dataset.density === "index" ? "index" : "cards");
      apply(false);
    })();
  </script>
</body>
</html>
`;
}
