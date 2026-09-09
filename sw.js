/* Homyo — Service Worker mínimo.
   Su única razón de ser es que Chrome/Android reconozca el sitio como una
   PWA instalable, para que el acceso directo de la pantalla de inicio use el
   icono del manifest (icons/homyo-icon-*.png) en lugar del icono genérico.

   Es deliberadamente ligero: NO cachea HTML de forma agresiva para evitar
   servir contenido obsoleto en una demo que se actualiza a menudo. Solo
   añade un fallback offline básico. */

const CACHE = "homyo-shell-v1";
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
      // No fallamos la instalación si algún recurso no está disponible.
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

// Network-first: siempre intentamos red primero (contenido fresco); si falla
// (offline) recurrimos a la caché del shell. Esto satisface el requisito de
// instalabilidad de tener un handler de fetch sin arriesgar contenido obsoleto.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    fetch(req).catch(() =>
      caches.match(req).then((hit) => hit || caches.match("./index.html"))
    )
  );
});
