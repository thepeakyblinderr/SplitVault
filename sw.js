const CACHE = 'moneymate-v2'; // bump on every deploy that must invalidate old cached shells
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', e => {
  // Delete ALL old caches (splitvault-v4, moneymate-v1, etc.)
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only handle same-origin app-shell GETs. Cross-origin calls (e.g. the
  // Gemini API) and non-GET requests must reach the network untouched.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;

  // Network-first for the HTML shell itself, so a new deploy is visible on
  // the very next load instead of being masked by a stale cached copy —
  // fall back to cache only when actually offline. Cache-first for
  // everything else (icons etc.), which rarely changes and benefits more
  // from being instant/offline-safe than from always being freshest.
  const isShell = e.request.mode === 'navigate' || e.request.url.endsWith('/index.html') || e.request.url.endsWith('/');
  if (isShell) {
    e.respondWith(
      fetch(e.request)
        .then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
