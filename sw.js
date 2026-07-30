const CACHE = 'daily-v10';
const PRECACHE = [
  './',
  './css/style.css',
  './js/date-utils.js',
  './js/domain.js',
  './js/app.js',
  './js/store.js',
  './js/pages/wish.js',
  './js/pages/expense.js',
  './js/pages/countdown.js',
  './js/pages/dashboard.js',
  './js/pages/note.js',
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
