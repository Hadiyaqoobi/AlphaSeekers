import { createHmac, randomUUID } from "crypto";

import { google } from "googleapis";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

type SignedStatePayload = {
  userId: string;
  locale: string;
  ts: number;
  nonce: string;
};

function getStateSecret() {
  return process.env.NEXTAUTH_SECRET ?? "local-dev-secret";
}

function getRedirectUri() {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI ?? `${process.env.NEXTAUTH_URL ?? "http://localhost:3005"}/api/integrations/google/callback`;
}

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

function signState(encodedPayload: string) {
  return createHmac("sha256", getStateSecret()).update(encodedPayload).digest("base64url");
}

function encodeState(payload: SignedStatePayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signState(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function decodeState(state: string): SignedStatePayload | null {
  const [encodedPayload, signature] = state.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = signState(encodedPayload);

  if (expected !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SignedStatePayload;

    if (!payload.userId || !payload.ts || !payload.locale) {
      return null;
    }

    if (Date.now() - payload.ts > STATE_MAX_AGE_MS) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function createGoogleAuthUrl(userId: string, locale = "fa") {
  const client = getGoogleOAuthClient();

  if (!client) {
    throw new Error("Google OAuth credentials are missing");
  }

  const state = encodeState({
    userId,
    locale,
    ts: Date.now(),
    nonce: randomUUID(),
  });

  return client.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_SCOPES as unknown as string[],
    prompt: "consent",
    include_granted_scopes: true,
    state,
  });
}

export function verifyGoogleState(state: string, expectedUserId: string) {
  const payload = decodeState(state);

  if (!payload || payload.userId !== expectedUserId) {
    return null;
  }

  return payload;
}

export async function exchangeGoogleCode(code: string) {
  const client = getGoogleOAuthClient();

  if (!client) {
    throw new Error("Google OAuth credentials are missing");
  }

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({
    auth: client,
    version: "v2",
  });

  const userInfo = await oauth2.userinfo.get();

  return {
    tokens,
    email: userInfo.data.email ?? null,
  };
}
