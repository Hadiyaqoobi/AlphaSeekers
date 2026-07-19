import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export async function GET(request: NextRequest) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      note: "Neon warm-up ping executed.",
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        note: "Neon warm-up ping failed.",
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
