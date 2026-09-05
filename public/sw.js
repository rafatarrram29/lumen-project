// Lumen service worker — runtime caching, not a hardcoded build manifest.
// Next.js's own JS/CSS chunk filenames are content-hashed per build and
// unknowable ahead of time without a build-time tool (Workbox/next-pwa),
// which this project doesn't have; caching them as they're actually
// requested (below) gets the same "fast repeat visits + works offline for
// pages already seen" outcome without that extra build step, or the risk
// of a stale precache list pointing at files that no longer exist after a
// deploy.
//
// Bump this on any change to the caching logic itself so old clients pick
// up the new worker and drop their old cache.
const CACHE_VERSION = "lumen-v2";
const OFFLINE_URL = "/offline.html";

// Known-stable, hand-written URLs (not build-hashed) — safe to precache by
// exact path so the very first visit already has an offline fallback and
// the manifest/icons needed to be installable.
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Signing out has to take the cache with it. Navigations are cached above,
// so without this the previous user's dashboard HTML stays on the device
// and would be served to whoever signs in next while offline — on a shared
// phone or a kiosk that is somebody else's data on somebody else's screen.
// The page asks for this on sign-out; the precache is rebuilt straight
// away so the offline fallback keeps working afterwards.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "LUMEN_CLEAR_CACHE") return;
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => caches.open(CACHE_VERSION))
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => event.source?.postMessage({ type: "LUMEN_CACHE_CLEARED" }))
      .catch(() => event.source?.postMessage({ type: "LUMEN_CACHE_CLEARED" })),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only ever intercept simple GETs — an upload, a rename, a targets
  // replace, anything mutating must always reach the real network, never
  // be answered from (or written into) the cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API routes are live, per-user, often-authenticated data — caching a
  // response here would risk silently serving one user's stale/wrong data
  // (or another's) later; if the network is down, this should fail
  // exactly the way it already does for any other API call.
  if (url.pathname.startsWith("/api/")) return;

  // A navigation (loading a page, not a sub-resource) — try the network
  // first so a signed-in user's dashboard is always fresh when online;
  // fall back to whatever of this exact page was last cached, and only
  // when there's truly nothing cached for it, show the offline page
  // instead of a browser's own default connection-error screen.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Everything else (the app's JS/CSS bundles, fonts, images) is either
  // content-hashed and immutable per build, or cheap to re-fetch — serve
  // from cache instantly when we already have it (this is what makes a
  // repeat visit feel instant), otherwise fetch it and cache it for next
  // time. A failed fetch with nothing cached just fails normally; there's
  // no meaningful "offline fallback" for a missing script or font.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
