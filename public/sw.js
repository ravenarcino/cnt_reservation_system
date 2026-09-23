/* CNT Reservation service worker.
 *
 * Offline behaviour is READ-ONLY:
 *  - pages and GET /api data: network first; when offline, the last copy
 *    this device saw is served, so the app still opens and shows data;
 *  - static files (JS, CSS, fonts, images): cache first;
 *  - anything that writes (POST/PATCH/PUT/DELETE): passed straight to the
 *    network; when offline it gets a 503 JSON error so the page shows a
 *    "you're offline" message instead of hanging.
 * Auth endpoints other than the session lookup are never cached. Cached
 * data is wiped on logout.
 */

const VERSION = "v1";
const STATIC_CACHE = `cnt-static-${VERSION}`;
const PAGE_CACHE = `cnt-pages-${VERSION}`;
const API_CACHE = `cnt-api-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = [STATIC_CACHE, PAGE_CACHE, API_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Logout: forget every cached page and API response for this device.
self.addEventListener("message", (event) => {
  if (event.data === "clear-user-cache") {
    event.waitUntil(Promise.all([caches.delete(API_CACHE), caches.delete(PAGE_CACHE)]));
  }
});

const offlineJson = () =>
  new Response(
    JSON.stringify({
      success: false,
      error: "You're offline. Changes can be saved once you're back online.",
    }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  );

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline and not cached");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Writes: never cached. Offline -> clear error the page can show.
  if (request.method !== "GET") {
    event.respondWith(fetch(request).catch(offlineJson));
    return;
  }

  // The session lookup is cached like other data so pages still know who is
  // signed in while offline (wiped on logout). Every other auth endpoint
  // (sign-in, CSRF, callbacks) and the public lookup always hit the server.
  if (url.pathname === "/api/auth/session") {
    event.respondWith(networkFirst(request, API_CACHE).catch(offlineJson));
    return;
  }
  if (url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/api/public")) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE).catch(offlineJson));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request, PAGE_CACHE).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons/") ||
    /\.(png|jpg|jpeg|svg|ico|woff2?|css|js)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
  }
});
