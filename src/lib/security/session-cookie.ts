/**
 * Re-issue the caller's own session cookie from inside a route handler.
 *
 * NextAuth only writes the session cookie from its own /api/auth routes. A
 * getServerSession() call in a route handler or server component runs the jwt
 * callback but THROWS AWAY the re-encoded token (its response object is a
 * no-op stub), so a claim changed mid-session never reaches the browser.
 *
 * That matters for exactly one flow today: changing your own password stamps
 * User.passwordChangedAt, which revokes every token issued before it — the
 * point of the change. The person who just changed it must not be signed out
 * by their own action, so the password route re-issues THEIR token carrying
 * the new stamp. Every other device keeps the old stamp and is revoked.
 *
 * Best-effort by design: on any problem it returns false and leaves the cookie
 * alone. The worst case is then that the user signs in again with the password
 * they just chose — never a session that outlives a password change.
 */
import type { NextRequest, NextResponse } from "next/server";
import { encode, getToken, type JWT } from "next-auth/jwt";

import { authOptions } from "@/lib/auth";

// NextAuth splits cookies above ~4 KB into numbered chunks. Our tokens are a
// few hundred bytes; anything near the limit is left to NextAuth to manage.
const MAX_SINGLE_COOKIE = 3800;

function secureCookie(): boolean {
  // Same rule NextAuth itself uses to pick the cookie name.
  return process.env.NEXTAUTH_URL?.startsWith("https://") ?? Boolean(process.env.VERCEL);
}

export async function reissueSessionToken(
  request: NextRequest,
  response: NextResponse,
  patch: Partial<JWT>,
): Promise<boolean> {
  const secret = authOptions.secret ?? process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) return false;

  try {
    const secure = secureCookie();
    const name = secure ? "__Secure-next-auth.session-token" : "next-auth.session-token";

    // A chunked cookie would need every chunk rewritten in step; not worth it.
    if (request.cookies.has(`${name}.0`)) return false;

    const current = await getToken({ req: request, secret, secureCookie: secure, cookieName: name });
    if (!current?.sub) return false;

    const maxAge = authOptions.session?.maxAge ?? 30 * 24 * 60 * 60;
    const value = await encode({ token: { ...current, ...patch }, secret, maxAge });
    if (value.length > MAX_SINGLE_COOKIE) return false;

    response.cookies.set(name, value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
      expires: new Date(Date.now() + maxAge * 1000),
    });
    return true;
  } catch (error) {
    console.error("[session-cookie] could not re-issue the session token:", error);
    return false;
  }
}
