import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { runtime } from "@/lib/runtime";
import { withCors, corsPreflight } from "@/lib/security/cors";

/**
 * GET /api/health          — liveness: is the web process answering?
 * GET /api/health?deep=1   — readiness: can it also reach the database?
 *
 * The plain form deliberately does NOT touch the database. Render calls this
 * path every few seconds, forever. When it ran `SELECT 1` each time, the Neon
 * compute never saw the five idle minutes it needs to suspend, so the database
 * was awake around the clock: roughly 180 compute-unit hours a month against a
 * free allowance of 100. The probe meant to keep the site up was what would have
 * taken it down mid-month.
 *
 * It also separates two failures that need different responses. If the database
 * is unreachable, restarting the web process (which is what a failing Render
 * health check does) fixes nothing.
 *
 * `?deep=1` keeps the old behaviour for the places that want it: verifying a
 * deploy, or a low-frequency external monitor. It runs a cheap `SELECT 1` and
 * returns 503 when the database is required but unreachable. The database is only
 * treated as *required* when the in-memory fallback is disabled (i.e.
 * production); in demo mode a missing DB is reported but is not unhealthy.
 *
 * Do NOT point anything that polls more often than every few minutes at the deep
 * form — that recreates the problem above.
 *
 * Both forms are unauthenticated and never leak secrets or error details.
 */
export async function GET(request: Request) {
  const version =
    process.env.APP_VERSION ?? process.env.RENDER_GIT_COMMIT ?? "unknown";

  const deep = new URL(request.url).searchParams.get("deep") === "1";

  if (!deep) {
    return withCors(
      NextResponse.json({
        ok: true,
        status: "ok" as const,
        service: "alphaseekers-platform",
        version,
        db: "unchecked" as const,
        timestamp: new Date().toISOString(),
      }),
      request,
    );
  }

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
