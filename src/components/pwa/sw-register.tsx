"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Step 1: Clear ALL caches programmatically (even if SW fails)
    if ("caches" in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    // Step 2: Unregister ALL existing service workers
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        return Promise.all(registrations.map((r) => r.unregister()));
      })
      .then(() => {
        // Step 3: Register the fresh v5 sw.js after a delay
        setTimeout(() => {
          navigator.serviceWorker.register("/sw.js").catch(() => {});
        }, 3000);
      })
      .catch(() => {});
  }, []);

  return null;
}
