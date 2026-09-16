/**
 * Integration tests for the class registration cutoff, against a REAL Postgres.
 *
 * The cutoff is enforced INSIDE the enrolment transaction, not in the UI, so
 * these tests go straight at enrollStudentInClass — the same path the API route
 * calls. Hiding the button is a courtesy; this is the control.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { decideEnrollment, enrollStudentInClass, listPendingEnrollments } from "@/lib/platform/db-store";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "regdeadline";
const email = (s: string) => `${TAG}+${s}@example.com`;

const DAY = 24 * 60 * 60 * 1000;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${TAG}+` } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.enrollment.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function makeStudent(slug: string) {
  return prisma.user.create({
    data: { name: `${TAG} ${slug}`, email: email(slug), role: "STUDENT", approvedAt: new Date() },
    select: { id: true },
  });
}

async function makeClass(slug: string, registrationDeadline: Date | null) {
  const teacher = await prisma.user.create({
    data: { name: `${TAG} t-${slug}`, email: email(`t-${slug}`), role: "TEACHER", approvedAt: new Date() },
    select: { id: true },
  });
  return prisma.class.create({
    data: {
      name: `${TAG} ${slug}`,
      subjectCategory: "English",
      description: "fixture",
      teacherId: teacher.id,
      maxStudents: 10,
      registrationDeadline,
    },
    select: { id: true },
  });
}

d("class registration deadline", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("accepts a request while the deadline is still ahead", async () => {
    const klass = await makeClass("open", new Date(Date.now() + DAY));
    const student = await makeStudent("intime");

    const result = await enrollStudentInClass(student.id, klass.id);
    expect(result.state).toBe("REQUESTED");
  });

  it("refuses a request once the deadline has passed", async () => {
    const klass = await makeClass("closed", new Date(Date.now() - DAY));
    const student = await makeStudent("late");

    await expect(enrollStudentInClass(student.id, klass.id)).rejects.toThrow("Registration closed");
    expect(await listPendingEnrollments(klass.id)).toHaveLength(0);
  });

  it("stays open forever when no deadline is set", async () => {
    // Every class created before this field existed has a null deadline, and
    // must keep behaving exactly as it did.
    const klass = await makeClass("nodeadline", null);
    const student = await makeStudent("whenever");

    const result = await enrollStudentInClass(student.id, klass.id);
    expect(result.state).toBe("REQUESTED");
  });

  it("does not disturb a student who was already approved before the cutoff", async () => {
    // The cutoff governs JOINING. Someone already on the roster must not be
    // affected when the date passes.
    const klass = await makeClass("grandfathered", new Date(Date.now() + DAY));
    const student = await makeStudent("early");

    await enrollStudentInClass(student.id, klass.id);
    const [pending] = await listPendingEnrollments(klass.id);
    await decideEnrollment(pending.enrollmentId, "APPROVE");

    await prisma.class.update({
      where: { id: klass.id },
      data: { registrationDeadline: new Date(Date.now() - DAY) },
    });

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: student.id, classId: klass.id },
      select: { status: true },
    });
    expect(enrollment?.status).toBe("ACTIVE");
  });

  it("honours a deadline moved forward mid-flight", async () => {
    // Re-read inside the transaction: a deadline edited after the page loaded
    // must win over whatever the student's browser believed.
    const klass = await makeClass("moved", new Date(Date.now() + DAY));
    const student = await makeStudent("racer");

    await prisma.class.update({
      where: { id: klass.id },
      data: { registrationDeadline: new Date(Date.now() - 1000) },
    });

    await expect(enrollStudentInClass(student.id, klass.id)).rejects.toThrow("Registration closed");
  });
});
