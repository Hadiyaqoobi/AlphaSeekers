// Service Worker v5 — Self-healing
// On install: immediately clear ALL old caches and take control
// This breaks the stale-cache cycle that was causing webpack chunk errors

const CACHE_VERSION = "v5";
const CACHE_NAME = `alphaseekers-${CACHE_VERSION}`;
const STATIC_CACHE = `alphaseekers-static-${CACHE_VERSION}`;
const MATERIAL_CACHE = "alphaseekers-materials-v2";

self.addEventListener("install", (event) => {
  // Immediately take over from any old service worker
  self.skipWaiting();

  event.waitUntil(
    // Delete ALL existing caches to clear any corrupted webpack chunks
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// MINIMAL fetch handler — network-only for everything
// This ensures we never serve stale/corrupted content
self.addEventListener("fetch", (event) => {
  // Only handle same-origin GET requests
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept Next.js internal requests
  if (url.pathname.includes("/_next/") || url.pathname.includes("__next")) return;

  // For API routes: network-only with offline fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response('{"error":"offline"}', {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // For navigation: network-only
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response("Offline", { status: 503 })
      )
    );
    return;
  }

  // Everything else: don't intercept, let the browser handle it normally
});
