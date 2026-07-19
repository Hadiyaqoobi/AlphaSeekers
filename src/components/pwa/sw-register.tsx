"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Register (or re-use the existing registration for) the service worker.
    // registration is idempotent: calling register() with the same URL returns
    // the active registration and only fetches/installs a new worker when the
    // script has actually changed. We deliberately do NOT unregister workers or
    // delete caches on load — doing so destroyed push subscriptions and offline
    // material caches on every visit.
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // When the browser finds a byte-different sw.js it installs it as a
          // waiting worker. Nudge it to activate so updates roll out promptly
          // via the standard skipWaiting/updatefound flow instead of a
          // wholesale cache wipe.
          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                // A new version is ready and an old one is controlling the page.
                installing.postMessage?.({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch(() => {
          // Registration failures are non-fatal; the app still works online.
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
