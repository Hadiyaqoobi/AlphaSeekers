/**
 * Integration tests for per-course access, against a REAL Postgres.
 *
 * Platform access and course access used to be the same thing: once an admin
 * approved a signup, that student could self-enrol into any class instantly.
 * Joining is now a REQUEST an admin decides, so these tests pin the boundary.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  decideEnrollment,
  enrollStudentInClass,
  listClassEnrollments,
  listPendingEnrollments,
} from "@/lib/platform/db-store";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "courseaccess";
const email = (s: string) => `${TAG}+${s}@example.com`;

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

async function makeClass(slug: string, maxStudents = 10) {
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
      maxStudents,
    },
    select: { id: true },
  });
}

d("per-course access", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("a platform-approved student only REQUESTS a course, they are not in it", async () => {
    const student = await makeStudent("asker");
    const klass = await makeClass("english");

    const result = await enrollStudentInClass(student.id, klass.id);
    expect(result.state).toBe("REQUESTED");

    // The roster is the thing that decides who is actually in the class.
    expect(await listClassEnrollments(klass.id)).toHaveLength(0);
    const pending = await listPendingEnrollments(klass.id);
    expect(pending).toHaveLength(1);
    expect(pending[0].studentId).toBe(student.id);
  });

  it("approval puts them on the roster; rejection does not", async () => {
    const klass = await makeClass("decide");
    const yes = await makeStudent("yes");
    const no = await makeStudent("no");
    await enrollStudentInClass(yes.id, klass.id);
    await enrollStudentInClass(no.id, klass.id);

    const requests = await listPendingEnrollments(klass.id);
    const idFor = (studentId: string) =>
      requests.find((r) => r.studentId === studentId)!.enrollmentId;

    expect((await decideEnrollment(idFor(yes.id), "APPROVE")).status).toBe("APPROVED");
    expect((await decideEnrollment(idFor(no.id), "REJECT")).status).toBe("REJECTED");

    const roster = await listClassEnrollments(klass.id);
    expect(roster.map((r) => r.studentId)).toEqual([yes.id]);
    expect(await listPendingEnrollments(klass.id)).toHaveLength(0);
  });

  it("a rejected student cannot re-request by clicking again", async () => {
    const student = await makeStudent("rejected");
    const klass = await makeClass("closed");
    await enrollStudentInClass(student.id, klass.id);
    const [req] = await listPendingEnrollments(klass.id);
    await decideEnrollment(req.enrollmentId, "REJECT");

    await expect(enrollStudentInClass(student.id, klass.id)).rejects.toThrow("Enrollment rejected");
  });

  it("re-requesting while pending does not reset their place in the queue", async () => {
    const student = await makeStudent("impatient");
    const klass = await makeClass("queue");
    await enrollStudentInClass(student.id, klass.id);

    const again = await enrollStudentInClass(student.id, klass.id);
    expect(again.state).toBe("ALREADY_REQUESTED");
    expect(await listPendingEnrollments(klass.id)).toHaveLength(1);
  });

  it("re-checks capacity at approval time, not just when the request was made", async () => {
    // Requests can sit in the queue while the class fills up. Approving blindly
    // would put more students in the room than the teacher agreed to.
    const klass = await makeClass("tiny", 1);
    const first = await makeStudent("first");
    const second = await makeStudent("second");
    await enrollStudentInClass(first.id, klass.id);
    await enrollStudentInClass(second.id, klass.id);

    const reqs = await listPendingEnrollments(klass.id);
    expect((await decideEnrollment(reqs[0].enrollmentId, "APPROVE")).status).toBe("APPROVED");
    expect((await decideEnrollment(reqs[1].enrollmentId, "APPROVE")).status).toBe("CLASS_FULL");

    expect(await listClassEnrollments(klass.id)).toHaveLength(1);
  });

  it("will not decide the same request twice", async () => {
    const student = await makeStudent("double");
    const klass = await makeClass("once");
    await enrollStudentInClass(student.id, klass.id);
    const [req] = await listPendingEnrollments(klass.id);

    expect((await decideEnrollment(req.enrollmentId, "APPROVE")).status).toBe("APPROVED");
    const second = await decideEnrollment(req.enrollmentId, "REJECT");
    expect(second.status).toBe("NOT_PENDING");
  });
});
