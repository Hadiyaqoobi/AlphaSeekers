import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { runtime } from "@/lib/runtime";
import { withCors, corsPreflight } from "@/lib/security/cors";

/**
 * GET /api/health
 *
 * Liveness + readiness probe for uptime monitors. Verifies DB connectivity
 * with a cheap `SELECT 1` and reports service/version so an alert can fire
 * when the app is up but the database is unreachable. Fast, unauthenticated,
 * and never leaks secrets or internal error details.
 *
 * The database is only treated as *required* when the in-memory fallback is
 * disabled (i.e. production). In demo mode the app is designed to serve from
 * the memory store, so a missing DB is reported but does not mark the service
 * unhealthy.
 */
export async function GET(request: Request) {
  const version =
    process.env.APP_VERSION ?? process.env.RENDER_GIT_COMMIT ?? "unknown";

  let dbUp = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbUp = false;
  }

  const dbRequired = !runtime.allowDbFallback;
  const healthy = dbUp || !dbRequired;

  const body = {
    ok: healthy,
    status: healthy ? ("ok" as const) : ("degraded" as const),
    service: "alphaseekers-platform",
    version,
    db: dbUp ? ("up" as const) : ("down" as const),
    timestamp: new Date().toISOString(),
  };

  return withCors(
    NextResponse.json(body, { status: healthy ? 200 : 503 }),
    request,
  );
}

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}
