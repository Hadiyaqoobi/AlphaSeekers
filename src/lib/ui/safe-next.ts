/**
 * Return-path handling for the sign-in page.
 *
 * Pages send people to /login with the page they wanted, so they land back on
 * it after signing in. Two parameter names are in use — `next` (our own) and
 * `callbackUrl` (NextAuth's) — and both are honoured. Either one is only
 * followed when it is a same-site path under a known locale; anything else
 * (another host, `//evil.com`, `/\evil.com`, `javascript:`) is dropped so the
 * login page can never be used as an open redirect.
 *
 * Client-safe (no imports).
 */

const LOCALES = ["fa", "en"] as const;

/** A path is safe if it is `/<locale>` or `/<locale>/...` with no scheme/host tricks. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;

  // Relative paths only. (An absolute same-origin URL is reduced to its path
  // by pickReturnPath, after the origin has been checked.)
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001F\\]/.test(value)) return null;

  const firstSegment = value.slice(1).split(/[/?#]/)[0];
  if (!(LOCALES as readonly string[]).includes(firstSegment)) return null;
  return value;
}

/**
 * Pick the return path from the login page's query string: `next` first, then
 * `callbackUrl`. Absolute URLs are only accepted when they match `origin`.
 */
export function pickReturnPath(
  params: { get(name: string): string | null },
  origin?: string,
): string | null {
  for (const name of ["next", "callbackUrl"]) {
    const raw = params.get(name);
    if (!raw) continue;
    let candidate = raw.trim();
    // NextAuth sometimes hands back an absolute URL for this same site.
    if (/^https?:\/\//i.test(candidate)) {
      try {
        const url = new URL(candidate);
        if (!origin || url.origin !== origin) continue;
        candidate = `${url.pathname}${url.search}${url.hash}`;
      } catch {
        continue;
      }
    }
    const safe = safeNextPath(candidate);
    if (safe) return safe;
  }
  return null;
}

/** `/<locale>/login?next=<path>` — the one way pages should send people to sign in. */
export function loginHref(locale: string, next?: string | null): string {
  const safe = safeNextPath(next);
  return safe ? `/${locale}/login?next=${encodeURIComponent(safe)}` : `/${locale}/login`;
}
