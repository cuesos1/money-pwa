'use strict';
const CACHE = 'money-pwa-v6';
const ASSETS = ['./', './index.html', './styles.css', './calculator.js', './finance.js', './store.js', './ui.js', './ledger.js', './app.js', './manifest.webmanifest', './icons/icon-180-v6.png', './icons/icon-192-v6.png', './icons/icon-512-v6.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('money-pwa-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => {
    if (event.request.mode === 'navigate') return caches.match('./index.html');
    return Response.error();
  })));
});
