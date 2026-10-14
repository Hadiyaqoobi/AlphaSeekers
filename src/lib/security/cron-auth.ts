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
 * A SUPER admin may still trigger these endpoints manually from the dashboard,
 * which keeps the "Run batch" buttons working without shipping the cron secret
 * to the browser. It used to be any session with role ADMIN, which includes
 * scoped employees who were never meant to run platform-wide jobs, and it was
 * judged from the JWT, so a demoted or deactivated admin kept the power until
 * the token refreshed. It is now a live database check (`requireSuperAdmin`).
 * Every cron handler is POST-only, so a cross-site GET riding on an admin's
 * cookies cannot start one either.
 */

import { createHash, timingSafeEqual } from "crypto";

import { NextResponse } from "next/server";

import { runtime } from "@/lib/runtime";
import { requireSuperAdmin } from "@/lib/security/permissions";

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
 *   - the caller is signed in as a SUPER admin, checked against the live user
 *     row (dashboard "run now" buttons).
 *
 * When CRON_SECRET is unset we allow the call ONLY outside production so
 * local development / cron testing keeps working; in production a missing
 * secret always denies (fail closed).
 *
 * The secret path is checked first and is a pure header compare: the hourly
 * tick must be able to decide "nothing due" without a database query.
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

  // No secret configured: permit only outside production (fail closed in prod).
  if (!configuredSecret && runtime.mode !== "production") {
    return null;
  }

  // A signed-in super admin may trigger cron endpoints manually. Live check:
  // a deactivated, demoted or temporary-password account is refused at once.
  // (No session cookie means no query.)
  try {
    await requireSuperAdmin();
    return null;
  } catch {
    // Not signed in, not a super admin, or the check itself failed: deny.
  }

  return NextResponse.json(
    { message: "Unauthorized cron call" },
    { status: 401 },
  );
}
