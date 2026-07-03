/**
 * service-worker.js — Offline support for Arrow Escape.
 *
 * Precaches the app shell on install and uses a cache-first strategy for
 * same-origin GET requests (caching modules as they are first requested). This
 * makes the game fully playable offline after the first visit. Bump CACHE to
 * invalidate old assets on release.
 */
const CACHE = 'arrow-escape-v1';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/tokens.css',
  './styles/base.css',
  './styles/components.css',
  './styles/screens.css',
  './styles/animations.css',
  './src/main.js',
  './assets/icons/favicon.svg',
  './assets/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Network-first: always prefer fresh content (so updates ship immediately),
  // fall back to the cache when offline. Successful responses refresh the cache.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        }),
      ),
  );
});
