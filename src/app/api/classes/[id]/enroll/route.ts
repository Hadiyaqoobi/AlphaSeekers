import { NextResponse } from "next/server";

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
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Enrollment failed" },
      { status: 400 },
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
