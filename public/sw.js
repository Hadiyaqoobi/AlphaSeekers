const CACHE_NAME = "alphaseekers-v3";
const STATIC_CACHE = "alphaseekers-static-v3";
const MATERIAL_CACHE = "alphaseekers-materials-v1";
const OFFLINE_PAGE = "/fa/offline";

// API routes to cache with network-first strategy
const API_ROUTES = [
  "/api/me/schedule",
  "/api/me/classes",
  "/api/me/notifications",
  "/api/classes",
];

// Static asset patterns to cache
const STATIC_PATTERNS = ["/_next/static/", "/favicon.ico", "/icon-192.png", "/icon-512.png"];

// Install: pre-cache offline fallback page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([OFFLINE_PAGE]).catch(() => Promise.resolve());
    }),
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== STATIC_CACHE && key !== MATERIAL_CACHE) {
            return caches.delete(key);
          }
          return Promise.resolve();
        }),
      ),
    ).then(() => self.clients.claim()),
  );
});

// Fetch handler with different strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Strategy 1: Cache-first for static assets (JS, CSS, fonts, images)
  if (STATIC_PATTERNS.some((p) => url.pathname.includes(p))) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        }),
      ),
    );
    return;
  }

  // Strategy 2: Network-first for API routes (schedule, classes, notifications)
  if (API_ROUTES.some((r) => url.pathname.includes(r))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cloned);
            });
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response('{"error":"offline"}', {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }))),
    );
    return;
  }

  // Strategy 3: Network-first for navigation requests, fallback to offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_PAGE).then((cached) => cached || new Response("Offline", { status: 503 })),
      ),
    );
    return;
  }

  // Strategy 4: For all other requests, try network then check material cache
  // This catches saved materials (PDFs, docs from R2) when offline
  event.respondWith(
    fetch(request).catch(() =>
      caches.open(MATERIAL_CACHE).then((cache) => cache.match(request)).then((cached) =>
        cached || new Response("Offline", { status: 503 }),
      ),
    ),
  );
});

// Push notifications
self.addEventListener("push", (event) => {
  const data = event.data
    ? event.data.json()
    : { title: "AlphaSeekers", body: "New notification" };

  event.waitUntil(
    self.registration.showNotification(data.title || "AlphaSeekers", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/fa/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/fa/dashboard";
  event.waitUntil(clients.openWindow(url));
});

// Background sync for offline enrollment
self.addEventListener("sync", (event) => {
  if (event.tag === "offline-enrollment") {
    event.waitUntil(replayOfflineEnrollments());
  }
});

async function replayOfflineEnrollments() {
  try {
    const db = await openEnrollmentDB();
    const tx = db.transaction("queue", "readonly");
    const store = tx.objectStore("queue");
    const items = await getAllFromStore(store);

    for (const item of items) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        });
        if (response.ok) {
          const deleteTx = db.transaction("queue", "readwrite");
          deleteTx.objectStore("queue").delete(item.id);
        }
      } catch {
        // Will retry on next sync
      }
    }
  } catch {
    // IndexedDB not available
  }
}

function openEnrollmentDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("alphaseekers-offline", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
