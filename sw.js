/**
 * KIRA JUARA — Service Worker
 * ---------------------------
 * Strategi: RANGKAIAN DAHULU (network-first).
 *   - Ada internet  → sentiasa ambil versi terbaharu dari GitHub Pages,
 *                     kemudian simpan salinan dalam cache.
 *   - Tiada internet→ guna salinan cache (permainan tetap boleh dimainkan).
 *
 * Kesannya: walaupun aplikasi ditambah ke skrin utama telefon, setiap kali
 * dibuka dengan internet ia akan menggunakan kod terkini secara automatik.
 *
 * Nota: TIDAK perlu tukar nombor di bawah setiap kali kod diubah — versi
 * baharu diambil dari rangkaian. Nombor ini hanya untuk membuang cache lama.
 */
const CACHE = 'kira-juara-v3';

const TERAS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();                        // terus ganti SW lama
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(TERAS)).catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nama = await caches.keys();
    await Promise.all(nama.filter(n => n !== CACHE).map(n => caches.delete(n)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (err) {}
    }
    await self.clients.claim();              // ambil alih tab yang sedang buka
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Panggilan API Apps Script — jangan sesekali cache.
  if (url.hostname.indexOf('script.google') === 0 ||
      url.hostname.indexOf('script.google') > -1) return;

  // Hanya uruskan fail dalam skop aplikasi sendiri.
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    try {
      const preload = await e.preloadResponse;
      const res = preload || await fetch(req, { cache: 'no-store' });
      if (res && res.ok) {
        const salinan = res.clone();
        caches.open(CACHE).then(c => c.put(req, salinan)).catch(() => {});
      }
      return res;
    } catch (err) {
      const cached = await caches.match(req) || await caches.match('./index.html');
      if (cached) return cached;
      return new Response('Tiada sambungan.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
