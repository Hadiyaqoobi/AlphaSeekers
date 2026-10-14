import * as React from "react";

/**
 * Per-request memoisation (React `cache`). One signed-in page view used to
 * resolve the session 3-5 times — layout, getAccessControl, the page itself —
 * and every call ran the JWT callback, which re-reads the user row once the
 * token is older than its re-check interval. Inside a server render or route
 * handler `cache` collapses those into one; where React provides no request
 * scope (tests, scripts) it is the identity, so behaviour is unchanged.
 */
export const requestCache: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as unknown as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);
