// sw.js — офлайн-кэш. Приложение и так считает всё на устройстве; кэш нужен
// только чтобы страница открывалась при перезагрузке без сети (роуминг).
// Стратегия: сеть первой, кэш — запасной вариант. Так обновление не залипает.

const CACHE = 'sharetrip-v1';
const SHELL = [
  '.',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/ui.js',
  'js/store.js',
  'js/db.js',
  'js/model.js',
  'js/money.js',
  'js/csv.js',
  'js/currencies.js',
  'js/split.js',
  'js/views/expenses.js',
  'js/views/expense-sheet.js',
  'js/views/accounts.js',
  'js/views/settle.js',
  'js/views/more.js',
  'manifest.webmanifest',
  'assets/symbol.png',
  'assets/logo-horizontal.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => { /* один недокачанный файл не должен ломать установку */ })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('index.html'))),
  );
});
