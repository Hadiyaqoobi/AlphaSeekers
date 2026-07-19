import { NextResponse } from "next/server";

import { isDatabaseAvailable } from "@/lib/platform/db-store";
import { getStoreFallbackState } from "@/lib/platform/fallback-state";
import { runtime } from "@/lib/runtime";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { forbidden, getSessionUser, unauthorized } from "@/lib/security/session";

export async function GET() {
  try {
    await requirePermission("ai.manage");
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "ADMIN") {
    return forbidden();
  }

  const databaseAvailable = await isDatabaseAvailable();

  return NextResponse.json({
    runtime: {
      mode: runtime.mode,
      allowDemoAuth: runtime.allowDemoAuth,
      allowAutoSeed: runtime.allowAutoSeed,
      allowMockMeetLinks: runtime.allowMockMeetLinks,
      allowDbFallback: runtime.allowDbFallback,
      publicLandingStats: runtime.publicLandingStats,
    },
    storage: getStoreFallbackState(),
    databaseAvailable,
    integrations: {
      googleOAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      resendConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      whatsappConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    },
    generatedAt: new Date().toISOString(),
  });
}

