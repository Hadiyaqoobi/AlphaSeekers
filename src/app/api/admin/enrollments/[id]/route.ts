import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { decideEnrollment } from "@/lib/platform/store";
import { emit } from "@/lib/events/bus";
import { recordAudit } from "@/lib/security/audit";
import { AccessError, requirePermission } from "@/lib/security/permissions";

/**
 * Admit or turn down a request to join a specific course.
 *
 * Course access is separate from platform access: being approved to use
 * AlphaSeekers does not put a student in every class, so each request is decided
 * here. Gated on classes.edit — deciding who is in a class is class management,
 * not user management.
 */
const schema = z.object({ decision: z.enum(["APPROVE", "REJECT"]) });

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  let access;
  try {
    access = await requirePermission("classes.edit");
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await decideEnrollment(params.id, parsed.data.decision);

  switch (result.status) {
    case "NOT_FOUND":
      return NextResponse.json({ message: "Request not found." }, { status: 404 });
    case "NOT_PENDING":
      return NextResponse.json(
        { message: `This request was already handled (${result.current}).`, code: "NOT_PENDING" },
        { status: 409 },
      );
    case "CLASS_UNAVAILABLE":
      return NextResponse.json(
        { message: "That class is no longer active.", code: "CLASS_UNAVAILABLE" },
        { status: 409 },
      );
    case "CLASS_FULL":
      // Re-checked at approval time: the class can fill while requests queue.
      return NextResponse.json(
        { message: "This class is now full.", code: "CLASS_FULL" },
        { status: 409 },
      );
    default:
      break;
  }

  await recordAudit({
    actorId: access.userId,
    actorEmail: access.email,
    action: result.status === "APPROVED" ? "enrollment.approve" : "enrollment.reject",
    targetType: "Enrollment",
    targetId: params.id,
    details: `class ${result.enrollment.classId}, student ${result.enrollment.studentId}`,
  });

  // Approved students get the same welcome as before — it just now fires when the
  // decision is made rather than when the request was submitted.
  if (result.status === "APPROVED") {
    try {
      await emit(
        "student.enrolled",
        { studentId: result.enrollment.studentId, classId: result.enrollment.classId },
        { dedupeKey: `enrolled:${result.enrollment.studentId}:${result.enrollment.classId}` },
      );
    } catch (error) {
      console.error("[enrollments] failed to emit student.enrolled", params.id, error);
    }
  }

  return NextResponse.json({ status: result.status });
}
