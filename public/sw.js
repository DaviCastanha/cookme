/*
 * CookMe service worker: lets the installed app (and the site) open without internet.
 *
 * - Pages ("/", "/workspace", legal pages): network first, cached copy when offline. The
 *   workspace is one page for every caderno (?p=<id>), so any caderno opens offline.
 * - /_next/static/*: build files with hashed names, cache first.
 * - /api/* is never touched.
 * - Next.js data requests (RSC) are not cached: when they fail offline, Next.js falls back to a
 *   full page load, which this worker answers from the cache.
 *
 * Cadernos themselves live in IndexedDB, not here. Bump VERSION only when this file's caching
 * rules change (each deploy is picked up by the network-first pages anyway).
 */
const VERSION = 'v1';
const PAGES_CACHE = `cookme-pages-${VERSION}`;
const STATIC_CACHE = `cookme-static-${VERSION}`;
const OWN_CACHES = [PAGES_CACHE, STATIC_CACHE];
const PAGES = ['/', '/workspace', '/privacidade', '/termos'];
const NETWORK_TIMEOUT = 5000;
const MAX_STATIC_ENTRIES = 600;

self.addEventListener('install', (event) => {
  event.waitUntil(precache().finally(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        const ours = key.startsWith('cookme-pages-') || key.startsWith('cookme-static-');
        if (ours && !OWN_CACHES.includes(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'cache-urls' && Array.isArray(event.data.urls)) {
    event.waitUntil(cacheStatic(event.data.urls));
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request, url));
    return;
  }
  if (request.headers.get('RSC') || url.searchParams.has('_rsc')) return;
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname.startsWith('/_next/')) return;
  // Icons, manifest and other public files.
  event.respondWith(staleWhileRevalidate(request));
});

/** Caches the pages and the build files they reference, so the very first offline open works. */
async function precache() {
  const pages = await caches.open(PAGES_CACHE);
  const assets = new Set();
  for (const path of PAGES.slice(0, 2)) {
    try {
      const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok || response.redirected) continue;
      const html = await response.clone().text();
      await pages.put(path, response);
      for (const match of html.matchAll(/\/_next\/static\/[^"'\s\\)]+/g)) assets.add(match[0]);
    } catch {
      // Offline during install: the pages get cached on the next visit.
    }
  }
  await cacheStatic([...assets]);
}

async function cacheStatic(urls) {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    urls.map(async (raw) => {
      try {
        const url = new URL(raw, self.location.origin);
        if (url.origin !== self.location.origin || !url.pathname.startsWith('/_next/static/')) return;
        if (await cache.match(url.href)) return;
        const response = await fetch(url.href);
        if (response.ok) await cache.put(url.href, response);
      } catch {
        // Ignore: it will be cached when the page asks for it.
      }
    }),
  );
  await trim(cache);
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))) await cache.delete(key);
}

function pageKey(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  return PAGES.includes(path) ? path : null;
}

async function navigate(request, url) {
  const key = pageKey(url);
  const cache = await caches.open(PAGES_CACHE);
  const network = fetch(request).then(async (response) => {
    if (key && response.ok && !response.redirected && response.type === 'basic') await cache.put(key, response.clone());
    return response;
  });
  network.catch(() => {}); // Handled below; avoids an unhandled rejection when the cache wins.

  const cached = key ? await cache.match(key) : undefined;
  try {
    if (!cached) return await network;
    // A slow connection should not keep the app from opening: the cached page is good enough.
    return await Promise.race([network, timeout(NETWORK_TIMEOUT).then(() => cached)]);
  } catch {
    if (cached) return cached;
    // Old links /workspace/<id> while offline.
    const legacy = /^\/workspace\/([^/]+)\/?$/.exec(url.pathname);
    if (legacy) return Response.redirect(`/workspace?p=${legacy[1]}`, 302);
    return (await cache.match('/')) ?? offlinePage();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request.url, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached ?? Response.error());
  return cached ?? network;
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function offlinePage() {
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CookMe</title><body style="font-family:system-ui,sans-serif;background:#faf6f0;color:#2a211b;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center">
<div><h1 style="font-size:1.4rem">Sem conexão</h1><p style="color:#4d4138;max-width:32ch">Abra o CookMe uma vez com internet neste aparelho. Depois disso, ele abre mesmo offline.</p>
<p><a href="/" style="color:#8061c9">Tentar de novo</a></p></div></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
