const CACHE = 'daily-v6';
const PRECACHE = [
  './',
  './css/style.css',
  './js/app.js',
  './js/store.js',
  './js/lib/md-parser.js',
  './js/lib/chart.js',
  './js/pages/wish.js',
  './js/pages/study.js',
  './js/pages/countdown.js',
  './js/pages/dashboard.js',
  './manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))),
    ])
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
      .catch(() => caches.match('./'))
  );
});
