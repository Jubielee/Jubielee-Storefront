"use strict";

const CACHE_PREFIX = "jubielee-storefront-";
const CACHE_NAME = `${CACHE_PREFIX}shell-v1`;

const SHELL_ASSETS = [
  "./index.html",
  "./offline.html",
  "./styles.css?v=20260801-mobile-app-1",
  "./config.js?v=1",
  "./app.js?v=20260801-buy-split-2",
  "./manifest.webmanifest",
  "./assets/store-mark.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/apple-touch-icon.png"
];

const OFFLINE_URL = new URL(
  "./offline.html",
  self.registration.scope
).href;

const SHELL_URLS = new Set(
  SHELL_ASSETS.map((asset) => {
    return new URL(
      asset,
      self.registration.scope
    ).href;
  })
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return (
                cacheName.startsWith(CACHE_PREFIX) &&
                cacheName !== CACHE_NAME
              );
            })
            .map((cacheName) => {
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  /*
   * Product, inventory, checkout, authentication, payment,
   * receipt, and order requests remain network-only.
   */
  if (
    requestUrl.pathname.includes("/api/") ||
    requestUrl.pathname.includes("/checkout") ||
    requestUrl.pathname.includes("/payment") ||
    requestUrl.pathname.includes("/receipt")
  ) {
    return;
  }

  /*
   * Navigation is network-first. When the network is
   * unavailable, show the dedicated offline page rather than
   * displaying stale inventory or payment information.
   */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );

    return;
  }

  /*
   * Only the explicitly listed storefront shell assets use
   * the cache. Product images and other dynamic resources are
   * not cached here.
   */
  if (!SHELL_URLS.has(request.url)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || !networkResponse.ok) {
          return networkResponse;
        }

        const responseCopy = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseCopy);
        });

        return networkResponse;
      });
    })
  );
});
