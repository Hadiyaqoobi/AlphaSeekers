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
  archiveClass,
  decideEnrollment,
  dropStudentFromClass,
  restoreClass,
  enrollStudentInClass,
  listClasses,
  listClassEnrollments,
  updateClass,
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

  it("a student who joins is IN the class immediately", async () => {
    // Changed deliberately: joining used to create a PENDING request that an
    // admin — usually a volunteer who is also a student — had to approve, and
    // people waited days or forever. Capacity, the registration deadline and
    // publishing are the gate now, and a teacher can remove someone after.
    const student = await makeStudent("asker");
    const klass = await makeClass("english");

    const result = await enrollStudentInClass(student.id, klass.id);
    expect(result.state).toBe("JOINED");

    const roster = await listClassEnrollments(klass.id);
    expect(roster.map((r) => r.studentId)).toEqual([student.id]);
    // Nothing is left sitting in a queue waiting for a human.
    expect(await listPendingEnrollments(klass.id)).toHaveLength(0);
  });

  it("admits a student to only one class even if she joins two simultaneously", async () => {
    const student = await makeStudent("racing");
    const first = await makeClass("race-one");
    const second = await makeClass("race-two");
    const outcomes = await Promise.allSettled([
      enrollStudentInClass(student.id, first.id),
      enrollStudentInClass(student.id, second.id),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((outcome) => outcome.status === "rejected")).toMatchObject({
      reason: { message: "ENROLLMENT_LIMIT" },
    });
    const active = await prisma.enrollment.findMany({ where: { studentId: student.id, status: "ACTIVE" } });
    expect(active).toHaveLength(1);
    const [joined] = active;
    const other = joined.classId === first.id ? second : first;
    expect((await enrollStudentInClass(student.id, joined.classId)).state).toBe("ALREADY_ENROLLED");
    await dropStudentFromClass(student.id, joined.classId, { by: "self" });
    expect((await enrollStudentInClass(student.id, other.id)).state).toBe("JOINED");
  });

  it("does not allow approval or restore to create a second active class", async () => {
    const student = await makeStudent("restore-limit");
    const first = await makeClass("restore-original");
    const second = await makeClass("restore-new");
    await enrollStudentInClass(student.id, first.id);
    const request = await prisma.enrollment.create({
      data: { studentId: student.id, classId: second.id, status: "PENDING" },
    });
    expect(await decideEnrollment(request.id, "APPROVE")).toEqual({ status: "ENROLLMENT_LIMIT" });
    expect(await prisma.enrollment.findUnique({ where: { id: request.id } })).toMatchObject({ status: "PENDING" });
    await archiveClass(first.id);
    expect(await decideEnrollment(request.id, "APPROVE")).toMatchObject({ status: "APPROVED" });
    await expect(restoreClass(first.id)).rejects.toThrow("ENROLLMENT_LIMIT");
    await dropStudentFromClass(student.id, second.id, { by: "self" });
    expect(await restoreClass(first.id)).toMatchObject({ status: "ACTIVE" });
  });

  it("filters and paginates more than ten classes in the same category", async () => {
    const first = await makeClass("catalog-first");
    const { teacherId } = await prisma.class.findUniqueOrThrow({ where: { id: first.id } });
    await updateClass(first.id, { courseCategory: "TECHNOLOGY" });
    await prisma.class.createMany({
      data: [
        ...Array.from({ length: 11 }, (_, i) => ({
          teacherId, name: `${TAG} catalog ${i}`, description: "fixture",
          subjectCategory: "Computing", maxStudents: 10, courseCategory: "TECHNOLOGY" as const,
        })),
        { teacherId, name: `${TAG} catalog other`, description: "fixture", subjectCategory: "Computing", maxStudents: 10, courseCategory: "OTHER_SKILLS" },
        { teacherId, name: `${TAG} catalog draft`, description: "fixture", subjectCategory: "Computing", maxStudents: 10, courseCategory: "TECHNOLOGY", published: false },
      ],
    });
    const params = { limit: 10, search: `${TAG} catalog`, courseCategory: "TECHNOLOGY" as const };
    const page1 = await listClasses(params);
    const page2 = await listClasses({ ...params, page: 2 });
    expect(page1.pagination).toMatchObject({ totalItems: 12, totalPages: 2 });
    expect(page1.items).toHaveLength(10);
    expect(page2.items).toHaveLength(2);
    const all = [...page1.items, ...page2.items];
    expect(new Set(all.map(({ id }) => id)).size).toBe(12);
    expect(all.every((item) => item.courseCategory === "TECHNOLOGY")).toBe(true);
  });

  it("LEGACY: students already sitting in PENDING can still be approved or rejected", async () => {
    // Joining no longer CREATES pending rows, but real students were left in
    // that state in production when this changed. They must not be stranded, so
    // the approval path stays fully working for rows that already exist.
    const klass = await makeClass("decide");
    const yes = await makeStudent("yes");
    const no = await makeStudent("no");
    for (const student of [yes, no]) {
      await prisma.enrollment.create({
        data: { studentId: student.id, classId: klass.id, status: "PENDING" },
      });
    }

    const requests = await listPendingEnrollments(klass.id);
    const idFor = (studentId: string) =>
      requests.find((r) => r.studentId === studentId)!.enrollmentId;

    expect((await decideEnrollment(idFor(yes.id), "APPROVE")).status).toBe("APPROVED");
    expect((await decideEnrollment(idFor(no.id), "REJECT")).status).toBe("REJECTED");

    const roster = await listClassEnrollments(klass.id);
    expect(roster.map((r) => r.studentId)).toEqual([yes.id]);
    expect(await listPendingEnrollments(klass.id)).toHaveLength(0);
  });

  it("a rejected student cannot let themselves back in by clicking again", async () => {
    // The one case where a human decision still overrides immediate joining:
    // someone an admin explicitly removed must not be able to undo that.
    const student = await makeStudent("rejected");
    const klass = await makeClass("closed");
    await prisma.enrollment.create({
      data: { studentId: student.id, classId: klass.id, status: "PENDING" },
    });
    const [req] = await listPendingEnrollments(klass.id);
    await decideEnrollment(req.enrollmentId, "REJECT");

    await expect(enrollStudentInClass(student.id, klass.id)).rejects.toThrow("Enrollment rejected");
  });

  it("joining twice is harmless", async () => {
    // Double-tapping Submit on a slow connection is normal, not an error.
    const student = await makeStudent("impatient");
    const klass = await makeClass("queue");
    await enrollStudentInClass(student.id, klass.id);

    const again = await enrollStudentInClass(student.id, klass.id);
    expect(again.state).toBe("ALREADY_ENROLLED");
    expect(await listClassEnrollments(klass.id)).toHaveLength(1);
  });

  it("LEGACY: re-checks capacity at approval time, not just when the request was made", async () => {
    // Pending rows predate immediate joining and can sit there while the class
    // fills up, so approving one blindly would put more students in the room
    // than the teacher agreed to. Created directly, because joining no longer
    // produces pending rows.
    const klass = await makeClass("tiny", 1);
    const first = await makeStudent("first");
    const second = await makeStudent("second");
    for (const student of [first, second]) {
      await prisma.enrollment.create({
        data: { studentId: student.id, classId: klass.id, status: "PENDING" },
      });
    }

    const reqs = await listPendingEnrollments(klass.id);
    expect((await decideEnrollment(reqs[0].enrollmentId, "APPROVE")).status).toBe("APPROVED");
    expect((await decideEnrollment(reqs[1].enrollmentId, "APPROVE")).status).toBe("CLASS_FULL");

    expect(await listClassEnrollments(klass.id)).toHaveLength(1);
  });

  it("LEGACY: will not decide the same request twice", async () => {
    const student = await makeStudent("double");
    const klass = await makeClass("once");
    await prisma.enrollment.create({
      data: { studentId: student.id, classId: klass.id, status: "PENDING" },
    });
    const [req] = await listPendingEnrollments(klass.id);

    expect((await decideEnrollment(req.enrollmentId, "APPROVE")).status).toBe("APPROVED");
    const second = await decideEnrollment(req.enrollmentId, "REJECT");
    expect(second.status).toBe("NOT_PENDING");
  });
});
