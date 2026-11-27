// Service worker: lets True Size Screens open without a connection.
//
// How saved files are kept up to date:
// - The page, the methodology page and the device list are fetched fresh when online (checked with the server every time),
//   so updates show right away. If the network fails or takes more than 3 seconds, the saved copy is used.
// - Icons and the manifest are saved when this worker installs, and used from the save after that.
// - The PDF reader (pdf.js) lives in a folder named after its version, such as pdfjs/6.5.438/, and is
//   saved the first time someone opens a PDF. A new version has new web addresses, so a saved copy of
//   an old version can never be mixed with a newer page.
// - Each new version of this file deletes the saved files of older versions when it takes over.
//
// What to change here:
// - After upgrading pdf.js: set PDFJS_VERSION to the new folder name (the same one as PDFJS in index.html).
// - After changing an icon, the manifest or this file's logic: bump VERSION.
// - After changing only index.html or devices.csv: nothing.
const VERSION = "v3";
const PDFJS_VERSION = "6.5.438";
const CORE_CACHE = "tss-core-" + VERSION;
const PDF_CACHE = "tss-pdfjs-" + PDFJS_VERSION;
const PDFJS_DIR = new URL("pdfjs/" + PDFJS_VERSION + "/", self.registration.scope).pathname;
const CORE = ["./", "methodology.html", "devices.csv", "manifest.webmanifest", "favicon.svg", "icon-192.png", "apple-touch-icon.png"];
// The whole PDF reader, saved together the first time a PDF is opened (so scans also work offline later)
const PDF_FILES = ["pdf.min.mjs", "pdf.worker.min.mjs", "wasm/jbig2.wasm", "wasm/openjpeg.wasm", "wasm/qcms_bg.wasm"];
const FRESH_WAIT_MS = 3000; // how long to wait for the network before using the saved copy

// Save any of the PDF reader's files that aren't saved yet
async function savePdfReader(files = PDF_FILES) {
  const cache = await caches.open(PDF_CACHE);
  for (const f of files) {
    if (await cache.match(PDFJS_DIR + f)) continue;
    const res = await fetch(PDFJS_DIR + f, { cache: "reload" });
    if (res.ok) await cache.put(PDFJS_DIR + f, res);
  }
}

// Did an older version of the site save the PDF reader? Then this visitor uses PDFs.
async function usedPdfBefore() {
  for (const key of await caches.keys()) {
    if (!key.startsWith("tss-") || key === PDF_CACHE) continue;
    const reqs = await (await caches.open(key)).keys();
    if (reqs.some(r => new URL(r.url).pathname.includes("/pdfjs/"))) return true;
  }
  return false;
}

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const core = await caches.open(CORE_CACHE);
    // cache: "reload" skips the browser's own short-term cache, so nothing stale gets saved
    await core.addAll(CORE.map(u => new Request(u, { cache: "reload" })));
    // Keep PDFs working offline across a pdf.js upgrade (best effort: a failure here doesn't stop the update)
    try {
      if (await usedPdfBefore()) await savePdfReader();
    } catch (err) { /* they'll be saved the next time a PDF is opened online */ }
    await self.skipWaiting();
  })());
});

// Delete every saved file that belongs to an older version
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("tss-") && k !== CORE_CACHE && k !== PDF_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// A response that followed a redirect can't be used for a page load, so copy it into a plain one
async function plain(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

// Try the network first, but give up after a few seconds and use the saved copy.
async function networkFirst(url, key) {
  const cache = await caches.open(CORE_CACHE);
  const net = fetch(url, { cache: "no-cache" }).then(plain).then(res => {
    if (res.ok) cache.put(key, res.clone());
    return res;
  });
  const timeout = new Promise(r => setTimeout(r, FRESH_WAIT_MS));
  const quick = await Promise.race([net.catch(() => null), timeout]);
  if (quick) return quick;
  const saved = await cache.match(key, { ignoreSearch: true });
  return saved || net; // nothing saved yet: keep waiting for the network
}

// Use the saved copy if there is one; otherwise fetch it and save it.
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(req, { ignoreSearch: true });
  if (saved) return saved;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // leave analytics etc. alone
  const scope = new URL(self.registration.scope).pathname;
  const path = url.pathname;
  if (req.mode === "navigate") {
    // Only the app and its methodology page are saved; other pages (a license file, say) load normally
    if (path === scope || path === scope + "index.html") return e.respondWith(networkFirst(url.href.split("#")[0], "./"));
    if (path === scope + "methodology.html") return e.respondWith(networkFirst(url.href.split("#")[0], "methodology.html"));
    return;
  }
  if (path === scope + "devices.csv") return e.respondWith(networkFirst(req.url, "devices.csv"));
  if (path.startsWith(PDFJS_DIR)) {
    // The page is loading the reader itself and its worker; fetch the image decoders in the background
    if (path.endsWith("/pdf.min.mjs")) e.waitUntil(savePdfReader(PDF_FILES.filter(f => f.startsWith("wasm/"))).catch(() => {}));
    return e.respondWith(cacheFirst(req, PDF_CACHE));
  }
  if (path.startsWith(scope + "pdfjs/")) return; // another version's files: straight from the network, never saved
  e.respondWith(cacheFirst(req, CORE_CACHE));
});
