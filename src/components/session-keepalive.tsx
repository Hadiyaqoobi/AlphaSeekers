"use client";

import { useEffect } from "react";

/**
 * Renews the sign-in cookie while someone is actually using the site.
 *
 * Server pages read the session with getServerSession(), which in next-auth 4
 * cannot write cookies — so the rotated token from the jwt callback is thrown
 * away. Two consequences: `lastValidatedAt` is never saved (every request more
 * than five minutes after sign-in re-reads the user row), and the session never
 * slides, so even a daily user is signed out exactly 7 days after signing in.
 *
 * GET /api/auth/session is the one place next-auth does write the cookie. This
 * calls it at most once an hour, only while the tab is visible, so it adds no
 * database wake-ups of its own: it only runs while the person is on a page,
 * which has already woken the database.
 */
const MIN_INTERVAL_MS = 60 * 60 * 1000;
const STORAGE_KEY = "as:session-refreshed-at";

function lastRefresh(): number {
  try {
    return Number(window.localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function markRefreshed(at: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // Private mode or blocked storage: worst case we refresh once per page load.
  }
}

export function SessionKeepalive() {
  useEffect(() => {
    let inFlight = false;

    const refresh = () => {
      if (inFlight || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh() < MIN_INTERVAL_MS) return;
      inFlight = true;
      markRefreshed(now);
      fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
        });
    };

    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  return null;
}
