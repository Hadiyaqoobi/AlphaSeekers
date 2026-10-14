// AlphaSeekers Service Worker
// Responsibilities:
//   1. Display web-push notifications ('push') and route taps ('notificationclick').
//   2. Serve user-saved offline materials from a STABLE cache (never wiped on load).
//   3. Provide graceful offline fallbacks for navigations and API calls.
//
// Cache-name discipline: the material cache name is stable and shared with the
// "Save offline" button (src/components/save-offline-button.tsx). It is NEVER
// deleted on install/activate, so saved files survive updates. Only stale
// caches from older SW versions are pruned on activate.
//
// WHAT IS (AND IS NOT) CACHED — and why.
//
//   Pages (HTML navigations) are NOT cached any more. Earlier versions stored
//   every page a signed-in user opened and, after a 3 s timeout, served that
//   copy BY URL. On a shared phone or a family/community-centre computer the
//   next person to open /fa/dashboard could be shown the previous student's
//   dashboard, and the only cleanup was the logout button (which also threw
//   away the student's saved materials). Navigations are now network-first
//   with no per-URL copy; when the network fails the only fallback is the
//   offline page, which is fetched WITHOUT cookies, so it never contains
//   anyone's data.
//
//   Saved materials (MATERIAL_CACHE) ARE kept, across updates AND across
//   logout. They are class files stored under their public file URL — the
//   same bytes for every student in the class, no account data inside — so
//   keeping them cannot leak one user's data to another, and wiping them on
//   logout only destroyed work a student did on purpose ("Save offline") to
//   study without a connection.

// There is no runtime page cache any more: "alphaseekers-runtime-v7" held
// per-user HTML, and activate() deletes it because it is not in KEEP_CACHES.
// Anonymous offline pages only (fetched with credentials: "omit").
const OFFLINE_CACHE = "alphaseekers-offline-v1";
// Must match MATERIAL_CACHE in src/components/save-offline-button.tsx.
const MATERIAL_CACHE = "alphaseekers-materials-v1";
const KEEP_CACHES = [OFFLINE_CACHE, MATERIAL_CACHE];

const OFFLINE_LOCALES = ["fa", "en"];
const DEFAULT_LOCALE = "fa";
const offlinePath = (locale) => `/${locale}/offline`;

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

self.addEventListener("install", (event) => {
  // Activate this version as soon as it has installed. We do not pre-delete
  // caches here — offline data must persist across updates.
  self.skipWaiting();
  // Pre-cache the translated offline page per locale, WITHOUT cookies so the
  // stored copy is the signed-out rendering (no name, no sidebar, no data).
  // Best effort: a failure here must never block installation.
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(OFFLINE_CACHE);
        await Promise.all(
          OFFLINE_LOCALES.map(async (locale) => {
            const response = await fetch(offlinePath(locale), { credentials: "omit", cache: "reload" });
            if (response && response.ok) await cache.put(offlinePath(locale), response);
          }),
        );
      } catch {
        // Offline at install time — the inline fallback below still works.
      }
    })(),
  );
});

/** The anonymous offline page for the locale in `url`, or the inline fallback. */
async function offlinePage(url) {
  const first = url.pathname.split("/")[1];
  const locale = OFFLINE_LOCALES.includes(first) ? first : DEFAULT_LOCALE;
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    const cached = await cache.match(offlinePath(locale));
    if (cached) return cached;
  } catch {
    // fall through
  }
  return offlineFallback();
}

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

      // 3. Navigations: network-first, NO per-URL page cache (see the header
      // comment: cached signed-in pages were served to whoever used the device
      // next). If the network fails, show the anonymous offline page.
      if (request.mode === "navigate") {
        try {
          return await fetch(request);
        } catch {
          return offlinePage(url);
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
