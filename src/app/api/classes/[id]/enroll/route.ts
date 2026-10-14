import { NextResponse } from "next/server";

import { emit } from "@/lib/events/bus";
import { prisma } from "@/lib/prisma";
import { MAX_ACTIVE_ENROLLMENTS } from "@/lib/platform/class-join";
import { dropStudentFromClass, enrollStudentInClass } from "@/lib/platform/store";
import { getSessionUser, isApproved, pendingApproval, roleAllowed, unauthorized } from "@/lib/security/session";

type Params = {
  params: { id: string };
};

// Cap simultaneous enrollments per student (MAX_ACTIVE_ENROLLMENTS, shared
// with the public join form so both doors agree). Admins are exempt so they
// can help with QA / impersonate test flows.

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

    // The student is in the class straight away now, so this is the welcome
    // moment: `student.enrolled` fans out to welcome_student and welcome_teacher.
    // It used to emit `enrollment.requested` (an admin "someone is waiting"
    // nudge) and leave the welcome to the approval route — with nothing left to
    // approve, that path would have sent the student nothing at all.
    //
    // Failing to notify must never fail the join: she IS enrolled, and telling
    // her otherwise would make her try again.
    if (result.state === "JOINED") {
      try {
        await emit(
          "student.enrolled",
          { classId: params.id, studentId: user.id },
          { dedupeKey: `student.enrolled:${result.enrollment.id}` },
        );
      } catch (error) {
        console.error("[classes/enroll] failed to emit student.enrolled", params.id, error);
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
    if (reason === "Registration closed") {
      return NextResponse.json(
        { message: "Registration for this class has closed.", code: "REGISTRATION_CLOSED" },
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

  // Leaving is the student's own choice, so it is reversible: DROPPED, and
  // they may join again. It only ever touches an ACTIVE or PENDING row — a
  // student a teacher removed (REJECTED) cannot turn that into DROPPED here
  // and walk back in.
  const dropped = await dropStudentFromClass(user.id, params.id, { by: "self" });

  if (!dropped) {
    return NextResponse.json({ message: "Enrollment not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Dropped from class", enrollment: dropped });
}
