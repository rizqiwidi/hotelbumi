/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.8
 * sw.js — Service worker aset statis (FR-V67-16 / FR-V65-05 butir 1)
 *
 * Cakupan sengaja sempit: hanya aset same-origin (logo, foto gerai, CSS, JS).
 * Navigasi selalu network-first supaya pembaruan konten dan portal admin tidak
 * pernah tertahan versi lama; permintaan lintas-origin (Google Apps Script)
 * dibiarkan lewat tanpa disentuh.
 */
'use strict';

var CACHE = 'bumi-static-v1';
var PRECACHE = [
  './',
  './assets/css/guest.css',
  './assets/js/config.js',
  './assets/images/logo-hotel.png',
  './assets/images/favicon.svg',
  './assets/images/outlets/arumanis.jpg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Portal admin sengaja tidak di-cache: staf harus selalu mendapat JS terbaru.
  if (url.pathname.indexOf('/admin/') !== -1) return;

  // Navigasi: jaringan dulu, cache hanya saat offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match('./'); });
      })
    );
    return;
  }

  // Aset statis: sajikan cache, perbarui di latar.
  e.respondWith(
    caches.match(req).then(function (hit) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || network;
    })
  );
});
