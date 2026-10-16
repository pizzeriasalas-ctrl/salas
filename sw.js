// Service worker compartido: deja index.html y admin.html abrir sin internet.
const V = 'salas-v11';
const LOCAL = ['./', 'index.html', 'admin.html', 'manifest.webmanifest', 'manifest-admin.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'icon-admin-192.png', 'icon-admin-512.png', 'icon-admin-maskable-512.png'];
const CDN = ['https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await Promise.all(LOCAL.map(u => c.add(u).catch(() => {})));
    await Promise.all(CDN.map(u => c.add(new Request(u, { mode: 'no-cors' })).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const propio = u.origin === location.origin;
  const sdk = u.hostname === 'www.gstatic.com' && u.pathname.includes('/firebasejs/');
  if (!propio && !sdk) return; // Firestore/Auth van directo a la red
  if (r.mode === 'navigate' || r.destination === 'document') {
    // HTML: red primero (para recibir actualizaciones), si tarda o falla → copia guardada
    e.respondWith((async () => {
      const c = await caches.open(V);
      try {
        const res = await Promise.race([fetch(r), new Promise((_, rej) => setTimeout(() => rej(), 3500))]);
        if (res && res.ok) c.put(u.pathname.endsWith('/') ? './' : u.pathname.split('/').pop(), res.clone());
        return res;
      } catch (_) {
        return (await c.match(r, { ignoreSearch: true })) || (await c.match(u.pathname.split('/').pop() || 'index.html')) || (await c.match('index.html'));
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = await c.match(r, { ignoreSearch: true });
    if (hit) return hit;
    try { const res = await fetch(r); if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone()); return res; }
    catch (_) { return hit || Response.error(); }
  })());
});
