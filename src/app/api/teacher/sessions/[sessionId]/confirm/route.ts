/**
 * POST /api/teacher/sessions/[sessionId]/confirm
 *
 * Instructor-managed (MANUAL) scheduling: accept an auto-proposed session's time
 * as-is, marking it instructor-confirmed. The acting user must own the session's
 * class (class.teacherId === their id) or hold the "classes.edit" permission. A
 * temp-password employee must reset their password before managing sessions.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { confirmSession } from "@/lib/scheduling/sessions";
import { can, getAccessControl, type AccessControl } from "@/lib/security/permissions";

export const dynamic = "force-dynamic";

type RouteContext = { params: { sessionId: string } };

/** Owning teacher, or a scoped employee holding classes.edit, may manage sessions. */
function canManageClass(access: AccessControl, teacherId: string): boolean {
  if (access.deactivated) return false;
  return access.userId === teacherId || can(access, "classes.edit");
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const access = await getAccessControl();
    if (!access) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (access.mustChangePassword) {
      return NextResponse.json(
        { message: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED" },
        { status: 403 },
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: params.sessionId },
      select: { id: true, class: { select: { teacherId: true } } },
    });
    if (!session) {
      return NextResponse.json({ message: "Session not found" }, { status: 404 });
    }
    if (!canManageClass(access, session.class.teacherId)) {
      return NextResponse.json({ message: "You cannot manage this class" }, { status: 403 });
    }

    const result = await confirmSession(session.id);
    if (!result.ok) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[teacher] confirmSession failed", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
