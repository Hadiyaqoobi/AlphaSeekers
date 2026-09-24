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

const RUNTIME_CACHE = "alphaseekers-runtime-v7";
// Must match MATERIAL_CACHE in src/components/save-offline-button.tsx.
const MATERIAL_CACHE = "alphaseekers-materials-v1";
const KEEP_CACHES = [RUNTIME_CACHE, MATERIAL_CACHE];

// How long a navigation waits for the network before falling back to a cached
// copy of that same page. Tuned for "slow", not "broken": long enough that a
// merely sluggish connection still serves fresh content, short enough that a
// student is not left looking at a blank screen wondering if it is working.
const NAVIGATION_TIMEOUT_MS = 3000;

/**
 * Last-resort offline page: nothing cached, and the network failed.
 *
 * The previous version returned the bare string "Offline" as text/plain — no
 * styling, nothing to do next, on a phone. This is a real page with a retry.
 *
 * ENGLISH ONLY, DELIBERATELY. This file is a static service worker; it cannot
 * reach next-intl, so any Dari here would have to be hand-written into the
 * source — and Dari on this platform is written by a native speaker on the
 * team, never invented. The two strings below are listed in
 * messages/TRANSLATION_NEEDED.md; once the team supplies the Dari, paste it in
 * and set lang/dir accordingly. Until then English is honest; invented Dari
 * would not be.
 */
function offlineFallback() {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AlphaSeekers</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#04140B;color:#E8F5EC;font-family:system-ui,-apple-system,sans-serif;padding:24px}
  .card{max-width:22rem;text-align:center}
  h1{font-size:1.25rem;margin:0 0 .5rem}
  p{font-size:.95rem;line-height:1.7;color:#9DB3A6;margin:0 0 1.25rem}
  button{background:#00C853;color:#04140B;border:0;border-radius:12px;
         padding:13px 22px;font-size:1rem;font-weight:700;cursor:pointer}
</style></head><body><div class="card">
<h1>No internet connection</h1>
<p>This page could not load. Check your connection and try again.</p>
<button onclick="location.reload()">Try again</button>
</div></body></html>`,
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

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

      // 3. Navigations: network-first, but with a DEADLINE.
      //
      // Plain network-first only helps when the network fails. On the
      // connections this platform is actually used on, the common case is not
      // "offline" — it is "so slow that fetch never settles". The request does
      // not reject, so the old code sat on a blank screen indefinitely while a
      // perfectly good cached copy of the page was sitting right there.
      //
      // So: race the network against a timer. If the network wins, serve and
      // re-cache it. If the timer wins and we have a cached copy, serve that
      // immediately — the student gets a usable page in about three seconds
      // instead of staring at white. The network request is NOT aborted; it is
      // left to finish and refresh the cache for next time.
      if (request.mode === "navigate") {
        const runtimeCache = await caches.open(RUNTIME_CACHE);

        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              // clone() before the body is consumed by whoever we hand it to.
              runtimeCache.put(request, response.clone()).catch(() => {});
            }
            return response;
          });

        const cachedPage = await runtimeCache.match(request);

        if (cachedPage) {
          const timeout = new Promise((resolve) =>
            setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS),
          );
          try {
            const winner = await Promise.race([network, timeout]);
            if (winner) return winner;
          } catch {
            // Network rejected outright — fall through to the cached copy.
          }
          return cachedPage;
        }

        // Nothing cached: we have no choice but to wait for the network.
        try {
          return await network;
        } catch {
          return offlineFallback();
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
