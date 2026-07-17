// Generate the gallery landing page (dist/index.html) + a derived registry
// (dist/apps.json) from the built apps. Per-app metadata resolution, first hit wins:
//   title       meta.title       -> <title>                     -> Title-Cased slug
//   description meta.description -> <meta name="description">    -> omitted
//   created     meta.created     -> git first-commit date        -> folder mtime
// Pure Node built-ins, no dependencies. Every interpolated value is HTML-escaped.
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
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

  writeFileSync(join(dist, "apps.json"), JSON.stringify({ version: 1, count: records.length, entries: records }, null, 2) + "\n");
  writeFileSync(join(dist, "index.html"), renderPage(records, site));
  console.log(`gallery: ${records.length} app(s) -> dist/index.html`);
  return records;
}

function renderCard(app, i) {
  const title = esc(app.title);
  const num = String(i + 1).padStart(2, "0");
  const descFr = app.description ? `<p class="card__desc">${esc(app.description)}</p>` : "";
  const descEn = app.description_en ? `<p class="card__desc-en" lang="en">${esc(app.description_en)}</p>` : "";
  const featured = app.featured ? `<span class="badge">à la une</span>` : "";
  const tags = app.tags.length
    ? `<ul class="tags">${app.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
    : "";
  return `      <a class="card" href="./${esc(app.slug)}/" style="--i:${i};--h:${app.hue}" role="listitem" aria-label="Ouvrir ${title}">
        <span class="card__rail" aria-hidden="true"></span>
        <div class="card__top">
          <span class="card__num" aria-hidden="true">${num}</span>
          ${featured}
          <time datetime="${esc(app.created)}">${esc(app.created)}</time>
        </div>
        <h2 class="card__title">${title}</h2>
        ${descFr}
        ${descEn}
        <div class="card__foot">
          ${tags}
          <span class="card__cta" aria-hidden="true">Ouvrir<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
        </div>
      </a>`;
}

function renderPage(apps, site) {
  const title = esc(site.title ?? "POC Lab");
  const taglineFr = esc(site.tagline_fr ?? "");
  const taglineEn = esc(site.tagline_en ?? "");
  const repo = site.repo ? esc(site.repo) : "";
  const cards = apps.length
    ? apps.map(renderCard).join("\n")
    : `      <p class="empty">Les premiers ateliers arrivent bientôt.<span>First experiments coming soon.</span></p>`;
  // The masthead spectrum: one segment per app, in gallery order, each in the
  // app's identity hue — the colour system of the grid, condensed into a strip.
  const spectrum = apps.length
    ? `<div class="spectrum" aria-hidden="true">${apps
        .map((a) => `<span style="--h:${a.hue}"></span>`)
        .join("")}</div>`
    : "";

  const sun = `<svg class="icon icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
  const moon = `<svg class="icon icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
  const github = `<svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`;

  return `<!doctype html>
<html lang="${esc(site.lang ?? "fr")}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${taglineFr}" />
  <meta name="color-scheme" content="light dark" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      color-scheme: light dark;
      --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --font-display: "Space Grotesk", var(--font-sans);
      --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", "Menlo", monospace;
      --step--1: clamp(0.78rem, 0.75rem + 0.1vw, 0.84rem);
      --step-0: clamp(0.94rem, 0.9rem + 0.2vw, 1rem);
      --step-1: clamp(1.12rem, 1.02rem + 0.45vw, 1.3rem);
      --step-2: clamp(2.3rem, 1.7rem + 2.6vw, 3.8rem);
      --sp-2: 0.5rem; --sp-3: 0.75rem; --sp-4: 1rem; --sp-6: 1.5rem; --sp-8: 2rem; --sp-12: 3rem;
      --radius: 18px; --maxw: 1120px;
      --bg: #faf9f6; --surface: #ffffff; --surface-2: #f1efe9; --border: #e6e2d9;
      --text: #1a1916; --muted: #6d6a61; --dot: rgba(26, 25, 22, 0.055);
      --accent-l: 52%; --accent-c: 0.13; --rail-l: 62%; --rail-c: 0.16;
      --shadow: 0 1px 2px rgba(24, 22, 18, 0.05), 0 1px 1px rgba(24, 22, 18, 0.04);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f0f12; --surface: #17171c; --surface-2: #1f1f26; --border: #2b2b34;
        --text: #f0efea; --muted: #9d9b93; --dot: rgba(240, 239, 234, 0.05);
        --accent-l: 76%; --accent-c: 0.11; --rail-l: 70%; --rail-c: 0.14;
        --shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      }
    }
    :root[data-theme="light"] { --bg: #faf9f6; --surface: #ffffff; --surface-2: #f1efe9; --border: #e6e2d9; --text: #1a1916; --muted: #6d6a61; --dot: rgba(26,25,22,0.055); --accent-l: 52%; --accent-c: 0.13; --rail-l: 62%; --rail-c: 0.16; --shadow: 0 1px 2px rgba(24,22,18,0.05); }
    :root[data-theme="dark"] { --bg: #0f0f12; --surface: #17171c; --surface-2: #1f1f26; --border: #2b2b34; --text: #f0efea; --muted: #9d9b93; --dot: rgba(240,239,234,0.05); --accent-l: 76%; --accent-c: 0.11; --rail-l: 70%; --rail-c: 0.14; --shadow: 0 1px 2px rgba(0,0,0,0.4); }

    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
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
    .wrap { max-width: var(--maxw); margin-inline: auto; padding: clamp(1.5rem, 5vw, 4.5rem) clamp(1.1rem, 4vw, 2rem) var(--sp-8); }

    header.masthead { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-4); margin-bottom: clamp(2.5rem, 6vw, 4.5rem); }
    .brand { display: flex; flex-direction: column; gap: var(--sp-3); min-width: 0; }
    .eyebrow { font-family: var(--font-mono); font-size: var(--step--1); letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }
    .eyebrow b { font-weight: 500; color: var(--text); }
    h1 { margin: 0; font-family: var(--font-display); font-size: var(--step-2); font-weight: 700; letter-spacing: -0.035em; line-height: 0.98; }
    .tagline { margin: 0; color: var(--muted); max-width: 52ch; text-wrap: balance; }
    .tagline .en { display: block; font-size: var(--step--1); opacity: 0.8; margin-top: 0.15em; }
    .spectrum { display: flex; gap: 3px; width: min(190px, 40vw); height: 4px; margin-top: var(--sp-2); }
    .spectrum span { flex: 1; border-radius: 99px; background: oklch(var(--rail-l) var(--rail-c) var(--h)); }

    .masthead__actions { flex: none; display: flex; gap: var(--sp-2); }
    .iconbtn {
      display: grid; place-items: center; width: 40px; height: 40px;
      border: 1px solid var(--border); border-radius: 12px; background: var(--surface);
      color: var(--text); cursor: pointer; box-shadow: var(--shadow); text-decoration: none;
      transition: border-color 0.18s ease, transform 0.18s ease;
    }
    .iconbtn:hover { border-color: color-mix(in oklab, var(--text) 35%, var(--border)); transform: translateY(-1px); }
    .icon-moon { display: none; }
    @media (prefers-color-scheme: dark) { .icon-sun { display: none; } .icon-moon { display: inline; } }
    :root[data-theme="dark"] .icon-sun { display: none; } :root[data-theme="dark"] .icon-moon { display: inline; }
    :root[data-theme="light"] .icon-sun { display: inline; } :root[data-theme="light"] .icon-moon { display: none; }

    .grid { display: grid; gap: var(--sp-6); grid-template-columns: repeat(auto-fill, minmax(min(100%, 310px), 1fr)); }

    .card {
      --accent: oklch(var(--accent-l) var(--accent-c) var(--h));
      --rail: oklch(var(--rail-l) var(--rail-c) var(--h));
      display: flex; flex-direction: column; gap: var(--sp-3);
      padding: var(--sp-6); text-decoration: none; color: inherit;
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      box-shadow: var(--shadow); position: relative; overflow: hidden;
      transition: transform 0.22s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 0.22s ease, border-color 0.22s ease;
    }
    .card__rail { position: absolute; inset: 0 0 auto 0; height: 3px; background: linear-gradient(90deg, var(--rail), transparent 78%); opacity: 0.65; transition: opacity 0.22s ease; }
    .card:hover { transform: translateY(-4px); border-color: color-mix(in oklab, var(--rail) 50%, var(--border)); box-shadow: 0 20px 44px -18px oklch(var(--rail-l) var(--rail-c) var(--h) / 0.45); }
    .card:hover .card__rail { opacity: 1; }
    .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

    .card__top { display: flex; align-items: baseline; gap: var(--sp-2); font-family: var(--font-mono); font-size: var(--step--1); }
    .card__num { font-weight: 500; color: var(--accent); }
    .card__top time { margin-left: auto; color: var(--muted); }
    .badge { font-size: 0.68rem; letter-spacing: 0.05em; padding: 0.15em 0.6em; border-radius: 999px; color: var(--accent); border: 1px solid color-mix(in oklab, var(--accent) 40%, transparent); }
    .card__title { margin: 0; font-family: var(--font-display); font-size: var(--step-1); font-weight: 600; letter-spacing: -0.015em; line-height: 1.18; transition: color 0.22s ease; }
    .card:hover .card__title { color: var(--accent); }
    .card__desc { margin: 0; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .card__desc-en { margin: 0; color: var(--muted); opacity: 0.72; font-size: var(--step--1); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .card__foot { margin-top: auto; padding-top: var(--sp-2); display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-2) var(--sp-3); font-family: var(--font-mono); font-size: var(--step--1); color: var(--muted); }
    .tags { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4em; }
    .tags li { padding: 0.12em 0.6em; border-radius: 7px; background: var(--surface-2); }
    .card__cta { margin-left: auto; display: inline-flex; align-items: center; gap: 0.35em; color: var(--accent); opacity: 0; transform: translateX(-6px); transition: opacity 0.22s ease, transform 0.22s ease; }
    .card:hover .card__cta, .card:focus-visible .card__cta { opacity: 1; transform: none; }

    .empty { grid-column: 1 / -1; color: var(--muted); text-align: center; padding: var(--sp-12) 0; }
    .empty span { display: block; font-size: var(--step--1); opacity: 0.8; }

    footer.foot { margin-top: var(--sp-12); padding-top: var(--sp-6); border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: var(--sp-3) var(--sp-6); justify-content: space-between; font-family: var(--font-mono); font-size: var(--step--1); color: var(--muted); }
    footer.foot a { color: var(--muted); text-decoration: none; border-bottom: 1px solid transparent; transition: color 0.18s ease, border-color 0.18s ease; }
    footer.foot a:hover { color: var(--text); border-color: currentColor; }

    @media (prefers-reduced-motion: no-preference) {
      .card { animation: rise 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) both; animation-delay: calc(var(--i, 0) * 55ms); }
      .brand > * { animation: rise 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
      .brand > *:nth-child(2) { animation-delay: 40ms; }
      .brand > *:nth-child(3) { animation-delay: 80ms; }
      .brand > *:nth-child(4) { animation-delay: 120ms; }
      @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="masthead">
      <div class="brand">
        <span class="eyebrow">adrientecher · <b>poc-lab</b></span>
        <h1>${title}</h1>
        <p class="tagline">${taglineFr}<span class="en" lang="en">${taglineEn}</span></p>
        ${spectrum}
      </div>
      <div class="masthead__actions">
        ${repo ? `<a class="iconbtn" href="${repo}" aria-label="Code source sur GitHub" title="Code source">${github}</a>` : ""}
        <button id="theme" class="iconbtn" type="button" aria-label="Basculer le thème clair / sombre" title="Thème clair / sombre">
          ${sun}${moon}
        </button>
      </div>
    </header>

    <main>
      <div class="grid" role="list">
${cards}
      </div>
    </main>

    <footer class="foot">
      <span>${apps.length} atelier${apps.length > 1 ? "s" : ""} · fait${apps.length > 1 ? "s" : ""} avec Claude</span>
      ${repo ? `<a href="${repo}">github.com/AdrienTecher/poc-lab</a>` : ""}
    </footer>
  </div>

  <script>
    (function () {
      var KEY = "poc-lab-theme";
      var root = document.documentElement;
      try { var saved = localStorage.getItem(KEY); if (saved) root.dataset.theme = saved; } catch (e) {}
      var btn = document.getElementById("theme");
      if (btn) btn.addEventListener("click", function () {
        var sysDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        var cur = root.dataset.theme || (sysDark ? "dark" : "light");
        var next = cur === "dark" ? "light" : "dark";
        root.dataset.theme = next;
        try { localStorage.setItem(KEY, next); } catch (e) {}
      });
    })();
  </script>
</body>
</html>
`;
}
