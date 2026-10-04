// Local journal data stays in localStorage, separate from disposable app caches.
const CACHE = 'one-more-game-v7';
const PAGES = ['/', '/history', '/stats', '/more'];
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PAGES);
    const assets = new Set(['/icon-sb.svg', '/icon-sb-192.png', '/icon-sb-512.png', '/apple-touch-icon-sb.png', '/manifest-anniversary.webmanifest']);
    for (const page of PAGES) {
      const response = await cache.match(page);
      const html = await response.text();
      for (const match of html.matchAll(/(?:src|href)="([^" ]+)"/g)) {
        if (match[1].startsWith('/_next/static/')) assets.add(match[1]);
      }
    }
    await cache.addAll([...assets]);
    // Font files are referenced by the bundled CSS rather than the page HTML.
    const fonts = new Set();
    for (const asset of assets) {
      if (!asset.endsWith('.css')) continue;
      const css = await (await cache.match(asset)).text();
      for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        const url = new URL(match[1], self.location.origin + asset);
        if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) fonts.add(url.pathname);
      }
    }
    await cache.addAll([...fonts]);
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('one-more-game-')).map(k => caches.delete(k))))]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.searchParams.has('_rsc')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy))); }
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match('/')) || Response.error()));
  } else if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy))); }
      return response;
    })));
  }
});
