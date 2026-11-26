import { Prisma } from "@prisma/client";

export const MAX_ACTIVE_ENROLLMENTS = 1;
export const ENROLLMENT_LIMIT_MESSAGE = "You can take only one active class at a time. Leave your current class before joining another.";

export class EnrollmentLimitError extends Error {
  constructor() {
    super("ENROLLMENT_LIMIT");
  }
}

// Acquire the class seat lock before any student locks. The two-argument
// advisory lock lives in a separate Postgres keyspace from the seat locks.
export async function lockEnrollmentStudent(tx: Prisma.TransactionClient, studentId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(418607, hashtext(${studentId}))`;
}

export async function lockEnrollmentStudents(tx: Prisma.TransactionClient, studentIds: string[]) {
  if (studentIds.length === 0) return;
  // Sorting all multi-student operations the same way avoids deadlocks and
  // acquiring the locks in one query avoids one database round trip per seat.
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(418607, hashtext(s.id))
    FROM unnest(ARRAY[${Prisma.join(studentIds)}]::text[]) AS s(id)
    ORDER BY s.id COLLATE "C"
  `;
}

export async function assertEnrollmentSlot(tx: Prisma.TransactionClient, studentId: string, classId: string) {
  await lockEnrollmentStudent(tx, studentId);
  const other = await tx.enrollment.findFirst({
    where: { studentId, classId: { not: classId }, status: "ACTIVE", class: { status: "ACTIVE" } },
    select: { id: true },
  });
  if (other) throw new EnrollmentLimitError();
}
