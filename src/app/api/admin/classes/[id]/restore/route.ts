/**
 * POST /api/admin/classes/[id]/restore — undo an archive.
 *
 * The danger zone has always promised "you can restore it later", but nothing
 * restored a class. Requires classes.edit (the same permission as editing it).
 */
import { NextRequest, NextResponse } from "next/server";

import { restoreClass } from "@/lib/platform/db-store";
import { EnrollmentLimitError } from "@/lib/platform/enrollment-limit";
import { recordAudit } from "@/lib/security/audit";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { getClientIp } from "@/lib/security/rate-limit";
import { getSessionUser, unauthorized } from "@/lib/security/session";

type Params = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Params) {
  let access;
  try {
    access = await requirePermission("classes.edit");
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const user = await getSessionUser();
  if (!user) {
    return unauthorized();
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ message: "Admin access only" }, { status: 403 });
  }

  let restored;
  try {
    restored = await restoreClass(params.id);
  } catch (error) {
    if (error instanceof EnrollmentLimitError) {
      return NextResponse.json(
        { code: "ENROLLMENT_LIMIT", message: "Some students are enrolled in another active class. Resolve those enrollments before restoring this class." },
        { status: 409 },
      );
    }
    throw error;
  }
  if (!restored) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  await recordAudit({
    actorId: access.userId,
    actorEmail: access.email,
    action: "class.restore",
    targetType: "Class",
    targetId: params.id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ message: "Class restored", class: restored });
}
