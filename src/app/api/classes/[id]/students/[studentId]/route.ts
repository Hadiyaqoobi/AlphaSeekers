/**
 * DELETE /api/classes/[id]/students/[studentId] — remove a student from a class.
 *
 * This is the safety valve that makes immediate joining acceptable. Anyone can
 * now put themselves into a published class without waiting for an approval, so
 * the person running the class needs to be able to take someone back out —
 * without going through an admin, because the teacher is the one who knows who
 * belongs there.
 *
 * Authorised by guardClassManagement: the class's OWN teacher, or an admin who
 * can manage it. A teacher cannot touch another teacher's roster.
 *
 * Sets the enrolment to DROPPED rather than deleting it, so attendance and
 * history survive and the removal is visible afterwards.
 */
import { NextRequest, NextResponse } from "next/server";

import { dropStudentFromClass } from "@/lib/platform/store";
import { guardClassManagement } from "@/lib/security/api-guard";
import { recordAudit } from "@/lib/security/audit";

type Params = { params: { id: string; studentId: string } };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const guard = await guardClassManagement(params.id);
  if (!guard.ok) return guard.response;

  const dropped = await dropStudentFromClass(params.studentId, params.id);
  if (!dropped) {
    return NextResponse.json({ message: "That student is not in this class." }, { status: 404 });
  }

  // Removing someone from a class is a people decision, not a routine edit —
  // it belongs in the audit trail so there is a record of who did it.
  await recordAudit({
    actorId: guard.access.userId,
    actorEmail: guard.access.email,
    action: "enrollment.removed",
    targetType: "Enrollment",
    targetId: `${params.id}:${params.studentId}`,
    details: `student ${params.studentId} removed from class ${params.id}`,
  });

  return NextResponse.json({ ok: true });
}
