// AlphaSeekers Service Worker
// Responsibilities:
//   1. Display web-push notifications ('push') and route taps ('notificationclick').
//   2. Serve user-saved offline materials from a STABLE cache (never wiped on load).
//   3. Provide graceful offline fallbacks for navigations and API calls.
//
// Cache-name discipline: the material cache name is stable and shared with the
// "Save offline" button (src/components/save-offline-button.tsx). It is NEVER
// deleted on install/activate, so saved files survive updates. Only stale
// *runtime* caches from older SW versions are pruned on activate.

const RUNTIME_CACHE = "alphaseekers-runtime-v6";
// Must match MATERIAL_CACHE in src/components/save-offline-button.tsx.
const MATERIAL_CACHE = "alphaseekers-materials-v1";
const KEEP_CACHES = [RUNTIME_CACHE, MATERIAL_CACHE];

self.addEventListener("install", () => {
  // Activate this version as soon as it has installed. We do not pre-delete
  // caches here — offline data must persist across updates.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Prune only stale runtime caches from previous SW versions. The material
      // cache and the current runtime cache are preserved.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("alphaseekers-") && !KEEP_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// Allow the page to tell a waiting worker to activate immediately.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  // 1. Saved offline materials: cache-first, regardless of origin (R2 assets are
  // cross-origin). If we have it, serve it — this is what makes "Save offline"
  // actually work offline.
  event.respondWith(
    (async () => {
      const materialCache = await caches.open(MATERIAL_CACHE);
      const cachedMaterial = await materialCache.match(request);
      if (cachedMaterial) return cachedMaterial;

      const url = new URL(request.url);
      const sameOrigin = url.origin === self.location.origin;

      // Never intercept Next.js internals — let the browser fetch chunks/data
      // directly so we can't serve a stale/corrupted build asset.
      if (sameOrigin && (url.pathname.includes("/_next/") || url.pathname.includes("__next"))) {
        return fetch(request);
      }

      // 2. API routes: network-only with a JSON offline fallback.
      if (sameOrigin && url.pathname.startsWith("/api/")) {
        try {
          return await fetch(request);
        } catch {
          return new Response('{"error":"offline"}', {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // 3. Navigations: network-first, fall back to a cached copy of the page,
      // then to a minimal offline response.
      if (request.mode === "navigate") {
        const runtimeCache = await caches.open(RUNTIME_CACHE);
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            runtimeCache.put(request, response.clone());
          }
          return response;
        } catch {
          const cachedPage = await runtimeCache.match(request);
          if (cachedPage) return cachedPage;
          return new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }
      }

      // 4. Everything else: pass through to the network.
      return fetch(request);
    })(),
  );
});

// --- Web Push ---------------------------------------------------------------

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || "AlphaSeekers";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/logo/wordmark-192.png",
    badge: payload.badge || "/logo/wordmark-192.png",
    tag: payload.tag || undefined,
    data: {
      url: payload.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Focus an already-open tab on this origin if one exists.
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin && "focus" in client) {
            await client.focus();
            if ("navigate" in client && targetUrl) {
              try {
                await client.navigate(targetUrl);
              } catch {
                // Some browsers disallow cross-document navigate(); ignore.
              }
            }
            return;
          }
        } catch {
          // Ignore malformed client URLs.
        }
      }

      // Otherwise open a new window.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
