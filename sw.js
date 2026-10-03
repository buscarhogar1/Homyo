/* Homyo — Service Worker.
   - HTML: network-first (contenido fresco) con fallback offline.
   - Recursos versionados (?v=…) y librerías de unpkg (versión fija):
     cache-first → cargas repetidas de map.html casi instantáneas. */

const CACHE = "homyo-shell-v2";
const SHELL = [
  "./index.html",
  "./site.webmanifest",
  "./icons/homyo-icon-192.png",
  "./icons/homyo-icon-512.png",
  "./icons/homyo-apple-touch.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(SHELL.map((url) => cache.add(url)))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isImmutableAsset(url) {
  if (url.hostname === "unpkg.com" && /@\d/.test(url.pathname)) return true;
  if (url.origin === self.location.origin && url.searchParams.has("v") && /\.(js|css|png|svg|webp)$/.test(url.pathname)) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req).then((hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
            return res;
          })
        )
      )
    );
    return;
  }

  event.respondWith(
    fetch(req).catch(() =>
      caches.match(req).then((hit) => hit || caches.match("./index.html"))
    )
  );
});
