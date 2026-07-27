// The offline cache. Not a source file and not a public file: vite.config.js reads
// this, fills in the two tokens and emits it as `sw.js` at the output root — because
// the thing that has to be precached is a list of CONTENT-HASHED filenames that only
// exist once the bundle does.
//
// The cache name carries a build hash of that same list, so a deploy that changes
// any byte changes the name and the old cache is dropped on activate. Nothing here
// needs a version bumped by hand, which is the failure mode of most hand-written
// service workers. (The token below is filled in by the plugin — do not name it in
// a comment, or a first-match replace will substitute the comment instead.)
const CACHE = "nuage-__VERSION__";
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (e) => {
  // skipWaiting so a returning player gets the new build on the next load rather
  // than on the load after that — this is a toy, not a document being edited, so
  // there is nothing in flight that a swap underneath could corrupt.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // nothing here is third-party any more

  // A navigation goes to the network FIRST, so an online player always gets the
  // current build; the cache is only the fallback for when there is no network. The
  // opposite order would strand somebody on an old build until the cache expired.
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match(PRECACHE[0]))),
    );
    return;
  }

  // Everything else is cache-first, which is safe precisely because vite hashes the
  // filenames: a changed asset is a different URL, so a stale hit is impossible.
  e.respondWith(
    caches.match(request).then((hit) => hit ?? fetch(request).then((res) => {
      if (res.ok && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    })),
  );
});
