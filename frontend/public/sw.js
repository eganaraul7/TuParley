/**
 * sw.js — Service Worker de TuParley
 *
 * Estrategias:
 *   - Navegación (HTML)        → network-first con fallback a caché (app shell offline)
 *   - Assets estáticos (JS/CSS/imágenes/fuentes) → cache-first
 *   - Peticiones /api/*        → network-only, sin interceptar
 *     (la cola offline de tickets se maneja en services/offlineQueue.js
 *      mediante IndexedDB + evento 'online' del navegador, no aquí)
 *
 * Versionar CACHE_VERSION en cada release para invalidar cachés viejos.
 */

const CACHE_VERSION   = 'tuparley-v1';
const CACHE_ESTATICOS = `${CACHE_VERSION}-estaticos`;
const CACHE_SHELL     = `${CACHE_VERSION}-shell`;

// Assets mínimos del app shell, precacheados al instalar
const ASSETS_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

const EXTENSIONES_ESTATICAS = /\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf)$/;

// ─── install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_SHELL)
      .then((cache) => cache.addAll(ASSETS_PRECACHE))
      .catch((err) => console.error('[SW] Error precacheando shell:', err)),
  );
});

// ─── activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => !nombre.startsWith(CACHE_VERSION))
          .map((nombre) => caches.delete(nombre)),
      ),
    ),
  );
  self.clients.claim();
});

// ─── message: activación inmediata pedida desde main.jsx ──────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // nunca interceptar llamadas a la API — siempre red directa
  if (url.pathname.startsWith('/api/')) {
    return; // dejar pasar sin event.respondWith()
  }

  // nunca interceptar WebSocket (socket.io)
  if (url.pathname.startsWith('/socket.io/')) {
    return;
  }

  // navegación (HTML): network-first con fallback a caché del shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(CACHE_SHELL).then((cache) => cache.put('/index.html', copia));
          return respuesta;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // assets estáticos: cache-first con actualización en segundo plano
  if (EXTENSIONES_ESTATICAS.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cacheada) => {
        const fetchPromise = fetch(request)
          .then((respuesta) => {
            if (respuesta.ok) {
              const copia = respuesta.clone();
              caches.open(CACHE_ESTATICOS).then((cache) => cache.put(request, copia));
            }
            return respuesta;
          })
          .catch(() => cacheada);

        return cacheada ?? fetchPromise;
      }),
    );
    return;
  }

  // todo lo demás: passthrough normal
});