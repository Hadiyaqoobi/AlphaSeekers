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

import { prisma } from "@/lib/prisma";
import {
  AccessError,
  can,
  getAccessControl,
  requirePermission,
  requireSuperAdmin,
  type AccessControl,
} from "@/lib/security/permissions";

export type GuardResult =
  | { ok: true; access: AccessControl }
  | { ok: false; response: NextResponse };

/**
 * Result of a class/session management guard. On success the resolved live
 * AccessControl is returned alongside the class's `teacherId` (and, for
 * session guards, the session identity) so the route never re-loads them.
 */
export type ClassManagementGuardResult =
  | { ok: true; access: AccessControl; teacherId: string }
  | { ok: false; response: NextResponse };

export type SessionManagementGuardResult =
  | {
      ok: true;
      access: AccessControl;
      session: { id: string; classId: string; teacherId: string };
    }
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

// ─── Class / session management guards ────────────────────────────────────────
//
// Centralizes the auth boilerplate that used to be copy-pasted (as an inline
// `canManageClass` helper plus the getAccessControl / mustChangePassword /
// deactivation / owner-or-`classes.edit` checks) across every teacher route:
// the acting user must own the target class (class.teacherId === their id) or
// hold "classes.edit", must not be deactivated, and must have reset any
// temporary password. Error responses reuse the exact JSON shapes
// `guardPermission` produces (`{ message }`, plus `code` for a password reset).

/**
 * Resolve the current request's access and apply the account-level gates shared
 * by both management guards: authenticated, not deactivated, and not blocked on
 * a required password change. Returns the live AccessControl or a shaped
 * failure response.
 */
async function resolveManagementActor(): Promise<
  { ok: true; access: AccessControl } | { ok: false; response: NextResponse }
> {
  const access = await getAccessControl();
  if (!access) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }
  if (access.deactivated) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Account deactivated" }, { status: 403 }),
    };
  }
  if (access.mustChangePassword) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, access };
}

/** Owning teacher, or a scoped employee holding classes.edit, may manage. */
function canManage(access: AccessControl, teacherId: string): boolean {
  return access.userId === teacherId || can(access, "classes.edit");
}

/** Fresh 403 per call — a NextResponse body is a one-shot stream, never shared. */
function notYourClass(): NextResponse {
  return NextResponse.json({ message: "You cannot manage this class" }, { status: 403 });
}

/**
 * Authorize management of a class by its id. On success returns the resolved
 * access and the class's `teacherId`.
 */
export async function guardClassManagement(
  classId: string,
): Promise<ClassManagementGuardResult> {
  const actor = await resolveManagementActor();
  if (!actor.ok) return actor;

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { teacherId: true },
  });
  if (!klass) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Class not found" }, { status: 404 }),
    };
  }
  if (!canManage(actor.access, klass.teacherId)) {
    return { ok: false, response: notYourClass() };
  }
  return { ok: true, access: actor.access, teacherId: klass.teacherId };
}

/**
 * Authorize management of a session by its id, applying the same class-ownership
 * logic against the session's parent class. On success returns the resolved
 * access and the session identity (id, classId, teacherId).
 */
export async function guardSessionManagement(
  sessionId: string,
): Promise<SessionManagementGuardResult> {
  const actor = await resolveManagementActor();
  if (!actor.ok) return actor;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, classId: true, class: { select: { teacherId: true } } },
  });
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Session not found" }, { status: 404 }),
    };
  }
  const teacherId = session.class.teacherId;
  if (!canManage(actor.access, teacherId)) {
    return { ok: false, response: notYourClass() };
  }
  return {
    ok: true,
    access: actor.access,
    session: { id: session.id, classId: session.classId, teacherId },
  };
}
