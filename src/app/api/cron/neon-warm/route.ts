import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/security/session";

async function hasCronAccess(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret) {
    return true;
  }

  if (request.headers.get("x-cron-secret") === configuredSecret) {
    return true;
  }

  const user = await getSessionUser();
  return user?.role === "ADMIN";
}

export async function GET(request: NextRequest) {
  if (!(await hasCronAccess(request))) {
    return NextResponse.json({ message: "Unauthorized cron call" }, { status: 401 });
  }

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
