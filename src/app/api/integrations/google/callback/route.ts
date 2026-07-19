import { NextRequest, NextResponse } from "next/server";

import { exchangeGoogleCode, verifyGoogleState } from "@/lib/integrations/google-auth";
import { prisma } from "@/lib/prisma";
import { encryptToRest } from "@/lib/security/crypto";
import { getSessionUser, unauthorized } from "@/lib/security/session";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ message: "Missing Google OAuth callback parameters" }, { status: 400 });
  }

  const verifiedState = verifyGoogleState(state, user.id);

  if (!verifiedState) {
    return NextResponse.json({ message: "Invalid Google OAuth state" }, { status: 400 });
  }

  try {
    const { tokens, email } = await exchangeGoogleCode(code);

    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return NextResponse.json(
        {
          message:
            "Google did not return a refresh token. Reconnect and ensure consent prompt is shown.",
        },
        { status: 400 },
      );
    }

    // Encrypt OAuth tokens at rest. These grant calendar-write access, so
    // they must never sit in the DB as plaintext. Read sites decrypt with
    // decryptFromRest (see needs_ops_action for the meet.ts read site).
    const encryptedRefreshToken = encryptToRest(refreshToken);
    const encryptedAccessToken = tokens.access_token
      ? encryptToRest(tokens.access_token)
      : null;

    await prisma.googleAccountLink.upsert({
      where: {
        userId: user.id,
      },
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

    return NextResponse.redirect(new URL(`/${verifiedState.locale}/dashboard?google=connected`, request.url));
  } catch {
    return NextResponse.redirect(new URL(`/${verifiedState.locale}/dashboard?google=failed`, request.url));
  }
}
