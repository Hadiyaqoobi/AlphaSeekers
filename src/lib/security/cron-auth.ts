/**
 * Cron endpoint authorization.
 *
 * A single guard used by every /api/cron/* route so authorization is
 * consistent and can't drift per-route. It fixes three problems the audit
 * found in the ad-hoc per-route checks:
 *
 *   1. FAIL-OPEN when CRON_SECRET was unset — any anonymous caller could
 *      trigger the reminder/scheduler/AI pipelines. We now fail CLOSED in
 *      production: a missing secret denies unless the caller is an admin.
 *   2. NON-TIMING-SAFE string comparison (`===`) — replaced with a
 *      constant-time compare over SHA-256 digests (also avoids leaking the
 *      secret length).
 *   3. INCONSISTENT header/scheme (`x-cron-secret` vs `Authorization`) —
 *      standardized on the single scheme our cron services already send:
 *      `Authorization: Bearer <CRON_SECRET>` (see render.yaml).
 *
 * Admins may still trigger these endpoints manually from the dashboard
 * (they are already fully privileged), which keeps the admin "Run batch"
 * buttons working without shipping the cron secret to the browser.
 */

import { createHash, timingSafeEqual } from "crypto";

import { NextResponse } from "next/server";

import { runtime } from "@/lib/runtime";
import { getSessionUser } from "@/lib/security/session";

/**
 * Constant-time comparison of two strings. Both sides are hashed to a
 * fixed-length digest first so the comparison never throws on length
 * mismatch and does not leak the secret's length via timing.
 */
function timingSafeEqualStrings(a: string, b: string): boolean {
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

/**
 * Authorize a cron invocation.
 *
 * Returns `null` when the request is authorized (caller proceeds), or a
 * ready-to-return `401` NextResponse when it is not.
 *
 * Authorization is granted when EITHER:
 *   - a valid `Authorization: Bearer <CRON_SECRET>` header is present
 *     (constant-time compared), OR
 *   - the caller is an authenticated ADMIN (dashboard "run now" buttons).
 *
 * When CRON_SECRET is unset we allow the call ONLY outside production so
 * local development / cron testing keeps working; in production a missing
 * secret always denies (fail closed).
 */
export async function assertCronAuthorized(
  request: Request,
): Promise<NextResponse | null> {
  const configuredSecret = process.env.CRON_SECRET;

  if (configuredSecret) {
    const provided = request.headers.get("authorization") ?? "";
    if (timingSafeEqualStrings(provided, `Bearer ${configuredSecret}`)) {
      return null;
    }
  }

  // An authenticated admin may trigger cron endpoints manually.
  const user = await getSessionUser();
  if (user?.role === "ADMIN") {
    return null;
  }

  // No secret configured: permit only outside production (fail closed in prod).
  if (!configuredSecret && runtime.mode !== "production") {
    return null;
  }

  return NextResponse.json(
    { message: "Unauthorized cron call" },
    { status: 401 },
  );
}
