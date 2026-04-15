"use client";

import { useEffect } from "react";

const SW_VERSION = "v4";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    // Unregister all existing service workers first (cleans stale v3 caches),
    // then re-register with the fresh sw.js
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        const unregisterAll = registrations.map((r) => r.unregister());
        return Promise.all(unregisterAll);
      })
      .then(() => {
        // Small delay to ensure old SW is fully gone before registering new one
        setTimeout(() => {
          navigator.serviceWorker.register(`/sw.js?${SW_VERSION}`).catch(() => {
            // Ignore registration failures
          });
        }, 1000);
      })
      .catch(() => {
        // Ignore errors
      });
  }, []);

  return null;
}
