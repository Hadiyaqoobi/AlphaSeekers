import { NextRequest, NextResponse } from "next/server";

import { exchangeGoogleCode, verifyGoogleState } from "@/lib/integrations/google-auth";
import { prisma } from "@/lib/prisma";
import { encryptToRest } from "@/lib/security/crypto";
import { getSessionUser, unauthorized } from "@/lib/security/session";

/**
 * Behind Render's proxy, request.url is the internal http://localhost:10000, so
 * building redirects from it sends the user to localhost. Use the public base
 * URL (NEXTAUTH_URL) instead.
 */
function publicBase(request: NextRequest): string {
  return (process.env.NEXTAUTH_URL || request.nextUrl.origin).replace(/\/+$/, "");
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  const base = publicBase(request);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const verifiedState = state ? verifyGoogleState(state, user.id) : null;
  const locale = verifiedState?.locale ?? "fa";
  const failRedirect = (reason: string) => {
    console.error(`[google-callback] failed: ${reason}`);
    return NextResponse.redirect(new URL(`/${locale}/dashboard?google=failed`, base));
  };

  if (oauthError) {
    return failRedirect(`oauth error param: ${oauthError}`);
  }
  if (!code || !state) {
    return failRedirect("missing code/state");
  }
  if (!verifiedState) {
    return failRedirect("invalid/expired state");
  }

  try {
    const { tokens, email } = await exchangeGoogleCode(code);

    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      return failRedirect("no refresh_token returned (revoke prior access + reconnect)");
    }

    // Encrypt OAuth tokens at rest — they grant calendar-write access.
    const encryptedRefreshToken = encryptToRest(refreshToken);
    const encryptedAccessToken = tokens.access_token ? encryptToRest(tokens.access_token) : null;

    await prisma.googleAccountLink.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        googleEmail: email,
        refreshToken: encryptedRefreshToken,
        accessToken: encryptedAccessToken,
        scope: tokens.scope ?? null,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      update: {
        googleEmail: email,
        refreshToken: encryptedRefreshToken,
        accessToken: encryptedAccessToken,
        scope: tokens.scope ?? null,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    return NextResponse.redirect(new URL(`/${locale}/dashboard?google=connected`, base));
  } catch (error) {
    // Surface the real reason to the server logs (was silently swallowed before).
    console.error(
      "[google-callback] exchange/store threw:",
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    return NextResponse.redirect(new URL(`/${locale}/dashboard?google=failed`, base));
  }
}
