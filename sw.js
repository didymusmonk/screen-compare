// Service worker: lets True Size Screens open without a connection.
// The page and device list are fetched fresh when online (so updates show
// right away) and fall back to the saved copy when offline or very slow.
// Other files (icons, the PDF reader) are saved the first time they load.
// To force every visitor to drop old saved files, change VERSION.
const VERSION = "v1";
const CACHE = "tss-" + VERSION;
const CORE = ["./", "devices.csv", "manifest.webmanifest", "favicon.svg", "icon-192.png", "apple-touch-icon.png"];
const FRESH_WAIT_MS = 3000; // how long to wait for the network before using the saved copy

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("tss-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Try the network first, but give up after a few seconds and use the saved copy.
async function networkFirst(req, key) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then(res => {
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
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
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
  if (req.mode === "navigate") return e.respondWith(networkFirst(req, "./"));
  if (url.pathname.endsWith("/devices.csv")) return e.respondWith(networkFirst(req, "devices.csv"));
  e.respondWith(cacheFirst(req));
});
