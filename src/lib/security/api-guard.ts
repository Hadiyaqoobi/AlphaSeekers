/**
 * Centralized API-route authorization guard.
 *
 * Replaces the copy-pasted `try { await requireX(); ... } catch (AccessError)`
 * boilerplate in every privileged route. A guard NEVER throws for an
 * authorization decision — it returns a discriminated result:
 *
 *   const guard = await guardPermission("users.edit");
 *   if (!guard.ok) return guard.response;   // 401 / 403 already shaped
 *   // ...guard.access is the resolved AccessControl (live DB row)...
 *
 * AccessErrors are converted to the same JSON shape the routes produced before
 * ({ message, status }), with an added `code: "PASSWORD_CHANGE_REQUIRED"` when a
 * temp-password employee is blocked. Any OTHER (unexpected) error is re-thrown
 * so the framework surfaces it as a genuine 500 rather than being masked as an
 * auth failure.
 */

import { NextResponse } from "next/server";

import {
  AccessError,
  requirePermission,
  requireSuperAdmin,
  type AccessControl,
} from "@/lib/security/permissions";

export type GuardResult =
  | { ok: true; access: AccessControl }
  | { ok: false; response: NextResponse };

/** Convert an AccessError into a JSON response; re-throw anything else. */
function toGuardFailure(error: unknown): { ok: false; response: NextResponse } {
  if (error instanceof AccessError) {
    const body: { message: string; code?: string } = { message: error.message };
    if (error.message === "PASSWORD_CHANGE_REQUIRED") {
      body.code = "PASSWORD_CHANGE_REQUIRED";
    }
    return { ok: false, response: NextResponse.json(body, { status: error.status }) };
  }
  // Not an authorization decision (e.g. a transient DB failure) — let it bubble
  // so the route/framework returns a real 500 instead of a misleading 403.
  throw error;
}

/** Require a specific "module.action" permission for the current request. */
export async function guardPermission(permission: string): Promise<GuardResult> {
  try {
    const access = await requirePermission(permission);
    return { ok: true, access };
  } catch (error) {
    return toGuardFailure(error);
  }
}

/** Require super-admin access for the current request. */
export async function guardSuper(): Promise<GuardResult> {
  try {
    const access = await requireSuperAdmin();
    return { ok: true, access };
  } catch (error) {
    return toGuardFailure(error);
  }
}
