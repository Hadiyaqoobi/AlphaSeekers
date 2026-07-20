"use client";

import { useEffect } from "react";

/**
 * Recovers from stale-chunk / deployment-skew crashes.
 *
 * When a new build is deployed while a page is already open, the next client
 * navigation may try to load a JS chunk (or a dynamically-imported module)
 * whose hashed filename no longer exists on the server — throwing a
 * ChunkLoadError and white-screening the app. We catch that and reload once to
 * pick up the fresh build, instead of leaving the user on a broken page.
 */
const RELOAD_FLAG = "as:chunk-reloaded";
const CHUNK_RE =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

function looksLikeChunkError(value: unknown): boolean {
  if (!value) return false;
  const err = value as { name?: string; message?: string };
  return (
    CHUNK_RE.test(err?.name ?? "") ||
    CHUNK_RE.test(err?.message ?? "") ||
    CHUNK_RE.test(String(value))
  );
}

function reloadOnce(): void {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return; // already reloaded once — don't loop
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    // sessionStorage unavailable — fall through and reload anyway.
  }
  window.location.reload();
}

export function ChunkErrorGuard() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      if (looksLikeChunkError(event.error) || looksLikeChunkError(event.message)) reloadOnce();
    }
    function onRejection(event: PromiseRejectionEvent) {
      if (looksLikeChunkError(event.reason)) reloadOnce();
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    // Once a build has loaded successfully, clear the flag so a future deploy
    // skew can recover again.
    const clear = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        /* ignore */
      }
    }, 15000);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.clearTimeout(clear);
    };
  }, []);

  return null;
}
