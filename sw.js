const VERSION = 'v202611251825';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'data/plays.js', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'reports/frontier.html', 'reports/side-hustle.html', 'reports/xianyu.html', 'reports/ai-accounts.html'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open('fr-' + VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('fr-') === 0 && k !== 'fr-' + VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// 网络优先（保证拿到新版），断网时用缓存
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) {
    var cp = r.clone();
    caches.open('fr-' + VERSION).then(function (c) { c.put(e.request, cp); });
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
