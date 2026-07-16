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
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      created:
        meta.created ??
        gitCreated(root, join("apps", slug)) ??
        statSync(join(root, "apps", slug)).mtime.toISOString().slice(0, 10),
      source: meta.source ?? "claude.ai",
      kind: meta.kind ?? kind,
      featured: meta.featured ?? false,
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
  const desc = app.description ? `<p class="card__desc">${esc(app.description)}</p>` : "";
  const featured = app.featured ? `<span class="badge">à la une</span>` : "";
  const tags = app.tags.length
    ? `<ul class="tags">${app.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
    : "";
  return `      <a class="card" href="./${esc(app.slug)}/" style="--i:${i}" aria-label="Ouvrir ${title}">
        <div class="card__head">
          <h2 class="card__title">${title}</h2>
          ${featured}
        </div>
        ${desc}
        <div class="card__foot">
          <time datetime="${esc(app.created)}">${esc(app.created)}</time>
          ${tags}
        </div>
        <span class="card__cta" aria-hidden="true">Ouvrir<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
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

  const sun = `<svg class="icon icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
  const moon = `<svg class="icon icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;

  return `<!doctype html>
<html lang="${esc(site.lang ?? "fr")}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${taglineFr}" />
  <meta name="color-scheme" content="light dark" />
  <style>
    :root {
      color-scheme: light dark;
      --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --font-mono: ui-monospace, "SFMono-Regular", "JetBrains Mono", "Menlo", monospace;
      --step--1: clamp(0.78rem, 0.75rem + 0.1vw, 0.84rem);
      --step-0: clamp(0.94rem, 0.9rem + 0.2vw, 1rem);
      --step-1: clamp(1.08rem, 1rem + 0.4vw, 1.22rem);
      --step-2: clamp(1.9rem, 1.5rem + 1.8vw, 2.9rem);
      --sp-2: 0.5rem; --sp-3: 0.75rem; --sp-4: 1rem; --sp-6: 1.5rem; --sp-8: 2rem; --sp-12: 3rem;
      --radius: 16px; --maxw: 1120px;
      --bg: #fbfaf8; --surface: #ffffff; --surface-2: #f4f2ee; --border: #e7e3dc;
      --text: #1b1a17; --muted: #6c6961; --accent: #4f46e5; --accent-soft: rgba(79, 70, 229, 0.1);
      --shadow: 0 1px 2px rgba(24, 22, 18, 0.05), 0 1px 1px rgba(24, 22, 18, 0.04);
      --shadow-lift: 0 14px 40px -12px rgba(24, 22, 18, 0.22);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #100f0e; --surface: #1a1917; --surface-2: #222018; --border: #302d28;
        --text: #f3f0ea; --muted: #a09b90; --accent: #a5b4fc; --accent-soft: rgba(165, 180, 252, 0.12);
        --shadow: 0 1px 2px rgba(0, 0, 0, 0.4); --shadow-lift: 0 16px 44px -12px rgba(0, 0, 0, 0.6);
      }
    }
    :root[data-theme="light"] { --bg: #fbfaf8; --surface: #ffffff; --surface-2: #f4f2ee; --border: #e7e3dc; --text: #1b1a17; --muted: #6c6961; --accent: #4f46e5; --accent-soft: rgba(79,70,229,0.1); --shadow: 0 1px 2px rgba(24,22,18,0.05); --shadow-lift: 0 14px 40px -12px rgba(24,22,18,0.22); }
    :root[data-theme="dark"] { --bg: #100f0e; --surface: #1a1917; --surface-2: #222018; --border: #302d28; --text: #f3f0ea; --muted: #a09b90; --accent: #a5b4fc; --accent-soft: rgba(165,180,252,0.12); --shadow: 0 1px 2px rgba(0,0,0,0.4); --shadow-lift: 0 16px 44px -12px rgba(0,0,0,0.6); }

    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      margin: 0; background: var(--bg); color: var(--text);
      font-family: var(--font-sans); font-size: var(--step-0); line-height: 1.55;
      -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
    }
    .wrap { max-width: var(--maxw); margin-inline: auto; padding: clamp(1.25rem, 4vw, 3.5rem) clamp(1.1rem, 4vw, 2rem) var(--sp-12); }

    header.masthead { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-4); margin-bottom: var(--sp-12); }
    .brand { display: flex; flex-direction: column; gap: var(--sp-2); }
    .eyebrow { font-family: var(--font-mono); font-size: var(--step--1); letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
    h1 { margin: 0; font-size: var(--step-2); font-weight: 640; letter-spacing: -0.02em; line-height: 1.02; }
    .tagline { margin: 0; color: var(--muted); max-width: 46ch; }
    .tagline .en { display: block; font-size: var(--step--1); opacity: 0.85; }

    .theme-toggle {
      flex: none; display: grid; place-items: center; width: 40px; height: 40px;
      border: 1px solid var(--border); border-radius: 12px; background: var(--surface);
      color: var(--text); cursor: pointer; box-shadow: var(--shadow);
      transition: border-color 0.18s ease, transform 0.18s ease, background 0.18s ease;
    }
    .theme-toggle:hover { border-color: var(--accent); transform: translateY(-1px); }
    .icon-moon { display: none; }
    @media (prefers-color-scheme: dark) { .icon-sun { display: none; } .icon-moon { display: inline; } }
    :root[data-theme="dark"] .icon-sun { display: none; } :root[data-theme="dark"] .icon-moon { display: inline; }
    :root[data-theme="light"] .icon-sun { display: inline; } :root[data-theme="light"] .icon-moon { display: none; }

    .grid { display: grid; gap: var(--sp-6); grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }

    .card {
      display: flex; flex-direction: column; gap: var(--sp-3);
      padding: var(--sp-6); text-decoration: none; color: inherit;
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      box-shadow: var(--shadow); position: relative; overflow: hidden;
      transition: transform 0.2s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .card::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 3px; background: var(--accent); opacity: 0; transition: opacity 0.2s ease; }
    .card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lift); border-color: color-mix(in oklab, var(--accent) 45%, var(--border)); }
    .card:hover::before { opacity: 1; }
    .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

    .card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-2); }
    .card__title { margin: 0; font-size: var(--step-1); font-weight: 620; letter-spacing: -0.01em; line-height: 1.2; }
    .badge { flex: none; font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.04em; padding: 0.2em 0.6em; border-radius: 999px; color: var(--accent); background: var(--accent-soft); }
    .card__desc { margin: 0; color: var(--muted); font-size: var(--step-0); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .card__foot { margin-top: auto; display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-2) var(--sp-3); font-family: var(--font-mono); font-size: var(--step--1); color: var(--muted); }
    .tags { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4em; }
    .tags li { padding: 0.1em 0.55em; border-radius: 6px; background: var(--surface-2); }
    .card__cta { display: inline-flex; align-items: center; gap: 0.35em; font-family: var(--font-mono); font-size: var(--step--1); color: var(--accent); opacity: 0; transform: translateX(-4px); transition: opacity 0.2s ease, transform 0.2s ease; }
    .card:hover .card__cta { opacity: 1; transform: none; }

    .empty { grid-column: 1 / -1; color: var(--muted); text-align: center; padding: var(--sp-12) 0; }
    .empty span { display: block; font-size: var(--step--1); opacity: 0.8; }

    footer.foot { margin-top: var(--sp-12); padding-top: var(--sp-6); border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: var(--sp-3); justify-content: space-between; font-family: var(--font-mono); font-size: var(--step--1); color: var(--muted); }
    footer.foot a { color: var(--muted); text-decoration: none; border-bottom: 1px solid transparent; transition: color 0.18s ease, border-color 0.18s ease; }
    footer.foot a:hover { color: var(--accent); border-color: var(--accent); }

    @media (prefers-reduced-motion: no-preference) {
      .card { animation: rise 0.5s both; animation-delay: calc(var(--i, 0) * 45ms); }
      @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    }
    @media (max-width: 560px) { header.masthead { flex-direction: row; } }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="masthead">
      <div class="brand">
        <span class="eyebrow">POC&nbsp;·&nbsp;Lab</span>
        <h1>${title}</h1>
        <p class="tagline">${taglineFr}<span class="en">${taglineEn}</span></p>
      </div>
      <button id="theme" class="theme-toggle" type="button" aria-label="Basculer le thème clair / sombre" title="Thème clair / sombre">
        ${sun}${moon}
      </button>
    </header>

    <main>
      <div class="grid" role="list">
${cards}
      </div>
    </main>

    <footer class="foot">
      <span>${apps.length} atelier${apps.length > 1 ? "s" : ""} · fait avec Claude</span>
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
