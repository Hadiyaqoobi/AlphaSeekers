import { NextRequest, NextResponse } from "next/server";

import { deleteUserAccount, setUserApproval, setUserRole } from "@/lib/platform/store";
import { dismissTeacherRequest } from "@/lib/platform/teacher-requests";
import { recordAudit } from "@/lib/security/audit";
import { AccessError, isSuper, requirePermission } from "@/lib/security/permissions";
import { getClientIp } from "@/lib/security/rate-limit";

type Params = {
  params: { id: string };
};

const ROLES = ["STUDENT", "TEACHER", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

function accessErrorResponse(error: unknown) {
  if (error instanceof AccessError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  return null;
}

/**
 * PATCH accepts independent mutations on one verb:
 *   { approved: boolean }     → approval queue                (users.approve)
 *   { role: "TEACHER" }       → change the auth role          (users.edit)
 *   { requestedRole: null }   → decline a teacher request     (users.edit)
 *
 * At least one must be present. Role changes are the fix for accounts that
 * signed up under the wrong role — the register form defaults to STUDENT, so a
 * teacher who submits without flipping the toggle is stored as a STUDENT and
 * never appears in the Create Class lecturer dropdown.
 *
 * EVERY permission and input check runs before ANY write. A request carrying
 * both a role and an approval used to save the role and then 403 on the
 * approval, reporting failure for a change that had in fact been made.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const body = (await request.json().catch(() => ({}))) as {
    approved?: unknown;
    role?: unknown;
    requestedRole?: unknown;
  };

  const wantsApproval = typeof body.approved === "boolean";
  const wantsRole = body.role !== undefined;
  const wantsDismiss = body.requestedRole === null;

  if (!wantsApproval && !wantsRole && !wantsDismiss) {
    return NextResponse.json(
      { message: "Provide an approved flag or a role to change." },
      { status: 400 },
    );
  }

  if (wantsRole && !isRole(body.role)) {
    return NextResponse.json(
      { message: "Role must be STUDENT, TEACHER or ADMIN." },
      { status: 400 },
    );
  }

  // ── Authorise everything up front ──────────────────────────────────────────
  let access;
  try {
    if (wantsRole || wantsDismiss) access = await requirePermission("users.edit");
    if (wantsApproval) access = await requirePermission("users.approve");
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    throw error;
  }
  if (!access) {
    // Unreachable (one of the branches above ran), but keeps the type honest.
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (wantsRole) {
    // Minting an admin is a privilege escalation — super admins only. A regular
    // admin can move people between STUDENT and TEACHER, which is all the
    // reported problem needs.
    if (body.role === "ADMIN" && !isSuper(access)) {
      return NextResponse.json(
        { message: "Only a super admin can grant the ADMIN role." },
        { status: 403 },
      );
    }

    // Never let an admin demote themselves out of the console they are using.
    if (params.id === access.userId && body.role !== "ADMIN") {
      return NextResponse.json(
        { message: "You cannot change your own role." },
        { status: 400 },
      );
    }
  }

  let updated: Record<string, unknown> | null = null;

  // ── Role change ────────────────────────────────────────────────────────────
  if (wantsRole) {
    const role = body.role as Role;
    // Changing an ADMIN's role is a super-admin action, mirroring DELETE below.
    // Passed IN so the check happens before the write: demoting a SUPER_ADMIN
    // would strip super powers (isSuper requires role=ADMIN) and bypass
    // super-store's "cannot demote the last super admin" guard entirely.
    const result = await setUserRole(params.id, role, {
      allowChangingAdmin: isSuper(access),
    });

    if (result.status === "NOT_FOUND") {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (result.status === "FORBIDDEN_ADMIN") {
      return NextResponse.json(
        { message: "Only a super admin can change an admin's role." },
        { status: 403 },
      );
    }

    updated = result.user;

    await recordAudit({
      actorId: access.userId,
      actorEmail: access.email,
      action: "user.role.change",
      targetType: "User",
      targetId: params.id,
      details: `role → ${role} (${result.user.email})`,
      ipAddress: getClientIp(request),
    });
  }

  // ── Decline a teacher request ──────────────────────────────────────────────
  if (wantsDismiss) {
    const dismissed = await dismissTeacherRequest(params.id);
    if (!dismissed) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    updated = { ...(updated ?? {}), ...dismissed };

    await recordAudit({
      actorId: access.userId,
      actorEmail: access.email,
      action: "user.teacher_request.dismiss",
      targetType: "User",
      targetId: params.id,
      details: `teacher request declined (${dismissed.email})`,
      ipAddress: getClientIp(request),
    });
  }

  // ── Approval ───────────────────────────────────────────────────────────────
  if (wantsApproval) {
    const approved = await setUserApproval(params.id, body.approved as boolean);

    if (!approved) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    updated = { ...(updated ?? {}), ...approved };

    await recordAudit({
      actorId: access.userId,
      actorEmail: access.email,
      action: body.approved ? "user.approve" : "user.unapprove",
      targetType: "User",
      targetId: params.id,
      details: `${body.approved ? "approved" : "approval revoked"} (${approved.email})`,
      ipAddress: getClientIp(request),
    });
  }

  return NextResponse.json(updated);
}

/**
 * Permanently delete a user account. Irreversible, so it is gated on
 * users.delete and refuses accounts that still own classes or materials
 * (see getUserDeletionBlockers — those FKs are restrict + NOT NULL).
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  let access;
  try {
    access = await requirePermission("users.delete");
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    throw error;
  }

  if (params.id === access.userId) {
    return NextResponse.json(
      { message: "You cannot delete your own account." },
      { status: 400 },
    );
  }

  // Deleting staff is a super-admin action; a regular admin can remove learners
  // and teachers but not their peers. Passed IN so the check happens before the
  // row is destroyed, not after.
  const result = await deleteUserAccount(params.id, {
    allowDeletingAdmin: isSuper(access),
  });

  if (result.status === "NOT_FOUND") {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  if (result.status === "FORBIDDEN_ADMIN") {
    return NextResponse.json(
      { message: "Only a super admin can delete an admin account." },
      { status: 403 },
    );
  }

  if (result.status === "BLOCKED") {
    const { teachingClasses, uploadedMaterials } = result.blockers;
    return NextResponse.json(
      {
        message:
          "This account still owns content and cannot be deleted yet. " +
          "Reassign or delete it first, then try again.",
        blockers: {
          teachingClasses: teachingClasses.map((c) => c.name),
          uploadedMaterials,
        },
      },
      { status: 409 },
    );
  }

  await recordAudit({
    actorId: access.userId,
    actorEmail: access.email,
    action: "user.delete",
    targetType: "User",
    targetId: params.id,
    details: `deleted ${result.user.role} ${result.user.email}`,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ message: "User deleted", id: result.user.id });
}
