// A static file server over the built app. The tests run against the real
// artifact in dist/, not the source tree: index.html loads an ES module, which
// a file:// origin refuses, and the built bundle is what actually ships.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

// What Pages serves, because a harness that mistypes an asset hides the class of
// bug where the real host does the same. The manifest type is not cosmetic: a
// browser handed the wrong one may decline to treat the app as installable at all.
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

export const serve = async (root) => {
  const server = createServer(async (req, res) => {
    // strip the query and refuse to climb out of the root
    // The deployed app is based at /poc-lab/<slug>/, and the built index.html
    // asks for its assets there — so serve the whole dist under that prefix and
    // the tests exercise the real production paths.
    const url = decodeURIComponent(req.url.split("?")[0]).replace(/^\/poc-lab\//, "/");
    const rel = normalize(url).replace(/^(\.\.[/\\])+/, "");
    const path = join(root, rel.endsWith("/") ? `${rel}index.html` : rel);
    try {
      const body = await readFile(path);
      res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}/`, close: () => new Promise((done) => server.close(done)) };
};
