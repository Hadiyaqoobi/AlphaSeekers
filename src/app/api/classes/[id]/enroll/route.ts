import { NextResponse } from "next/server";

import { emit } from "@/lib/events/bus";
import { prisma } from "@/lib/prisma";
import { dropStudentFromClass, enrollStudentInClass } from "@/lib/platform/store";
import { getSessionUser, isApproved, pendingApproval, roleAllowed, unauthorized } from "@/lib/security/session";

type Params = {
  params: { id: string };
};

// Cap simultaneous enrollments per student. Admins are exempt so they can
// help with QA / impersonate test flows. Override via env if a partner
// program needs more (UAT 2026-04-26 MED-A — Tester 1, Shahla).
const MAX_ACTIVE_ENROLLMENTS = (() => {
  const raw = Number(process.env.MAX_ACTIVE_ENROLLMENTS);
  return Number.isFinite(raw) && raw > 0 ? raw : 3;
})();

export async function POST(_: Request, { params }: Params) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (!isApproved(user)) {
    return pendingApproval();
  }

  if (!roleAllowed(user.role, ["STUDENT", "ADMIN"])) {
    return NextResponse.json({ message: "Only students can enroll." }, { status: 403 });
  }

  if (user.role === "STUDENT") {
    try {
      const activeCount = await prisma.enrollment.count({
        where: { studentId: user.id, status: "ACTIVE", classId: { not: params.id } },
      });
      if (activeCount >= MAX_ACTIVE_ENROLLMENTS) {
        return NextResponse.json(
          {
            message: `You can join up to ${MAX_ACTIVE_ENROLLMENTS} classes at a time. Drop one to add another.`,
            code: "ENROLLMENT_LIMIT",
            limit: MAX_ACTIVE_ENROLLMENTS,
          },
          { status: 409 },
        );
      }
    } catch {
      // If the count query fails, fall through — the underlying enroll call
      // will surface the real error rather than silently blocking.
    }
  }

  try {
    const result = await enrollStudentInClass(user.id, params.id);

    // No student.enrolled event here any more: joining is now a REQUEST, and the
    // welcome only makes sense once an admin approves it. The approval route
    // emits it instead.
    //
    // The request itself still has to reach a human, though — without this the
    // only way to learn someone is waiting is to open the class and look.
    // Failing to notify must not fail the request: the student has successfully
    // asked, and telling her otherwise would make her ask again.
    if (result.state === "REQUESTED") {
      try {
        await emit(
          "enrollment.requested",
          { classId: params.id, studentId: user.id },
          { dedupeKey: `enrollment.requested:${result.enrollment.id}` },
        );
      } catch (error) {
        console.error("[classes/enroll] failed to emit enrollment.requested", params.id, error);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    // Map known business errors to clean statuses; never leak internal
    // messages/stack details to the client — log them server-side instead.
    const reason = error instanceof Error ? error.message : "";

    if (reason === "Class is full") {
      return NextResponse.json(
        { message: "This class is full.", code: "CLASS_FULL" },
        { status: 409 },
      );
    }
    if (reason === "Enrollment rejected") {
      return NextResponse.json(
        { message: "Your request for this class was not approved.", code: "ENROLLMENT_REJECTED" },
        { status: 403 },
      );
    }

    if (reason === "Class not found") {
      return NextResponse.json({ message: "Class not found." }, { status: 404 });
    }
    if (reason === "Student not found") {
      return NextResponse.json(
        { message: "Only approved students can enroll." },
        { status: 403 },
      );
    }

    console.error("[classes/enroll] enrollment failed:", error);
    return NextResponse.json(
      { message: "Enrollment failed. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (!isApproved(user)) {
    return pendingApproval();
  }

  const dropped = await dropStudentFromClass(user.id, params.id);

  if (!dropped) {
    return NextResponse.json({ message: "Enrollment not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Dropped from class", enrollment: dropped });
}
