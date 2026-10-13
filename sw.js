// Service worker: makes Block Fit installable and playable offline.
// Network-first for the app's own files so a deploy shows up on the next launch;
// the cache is only the offline fallback. Google Fonts are cache-first (they never change).
// Only this game's cache is read: other apps on the same github.io origin have their own.
// Bump CACHE when cached files change without changing their URL.
const CACHE = 'block-fit-v4';
const fromCache = (req, opts) => caches.open(CACHE).then((c) => c.match(req, opts));
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/main.js',
  'js/config.js',
  'js/game.js',
  'js/board.js',
  'js/renderer.js',
  'js/input.js',
  'js/fx.js',
  'js/audio.js',
  'js/storage.js',
  'js/themes.js',
  'js/pieces.js',
  'js/modifiers.js',
  'js/rng.js',
  'js/solver.js',
  'js/solver-worker.js',
  'assets/icon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('block-fit-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      fromCache(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => fromCache(req, { ignoreSearch: true }).then((hit) => hit || fromCache('./'))),
  );
});
