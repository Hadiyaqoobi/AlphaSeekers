/**
 * Integration tests for admin user management against a REAL Postgres.
 *
 * Covers the two capabilities added for the "new teachers do not appear in the
 * Create Class lecturer list" report:
 *   - setUserRole, which is the actual fix (signup defaults to STUDENT, so a
 *     teacher who does not flip the register toggle is stored as a STUDENT and
 *     is invisible to listUsersByRole("TEACHER")); and
 *   - deleteUserAccount, including the guards that must run BEFORE the row is
 *     destroyed.
 *
 * Runs only when DATABASE_URL points at a disposable test database.
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  deleteUserAccount,
  getUserDeletionBlockers,
  listUsersByRole,
  setUserRole,
} from "@/lib/platform/db-store";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const TAG = "useradmintest";
const email = (s: string) => `${TAG}+${s}@example.com`;

const d = shouldRun ? describe : describe.skip;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${TAG}+` } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.material.deleteMany({ where: { uploadedBy: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.attendance.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.material.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function makeUser(slug: string, role: "STUDENT" | "TEACHER" | "ADMIN") {
  return prisma.user.create({
    data: { name: `${TAG} ${slug}`, email: email(slug), role, approvedAt: new Date() },
    select: { id: true, role: true },
  });
}

async function makeClass(teacherId: string, name: string) {
  return prisma.class.create({
    data: {
      name: `${TAG} ${name}`,
      subjectCategory: "English",
      description: "fixture",
      teacherId,
      maxStudents: 10,
    },
    select: { id: true },
  });
}

d("admin user management", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("promotes a STUDENT to TEACHER so they appear in the lecturer list", async () => {
    const user = await makeUser("promote", "STUDENT");

    // The reported bug: signed up as a teacher, stored as a student, therefore
    // absent from the Create Class dropdown.
    const before = await listUsersByRole("TEACHER");
    expect(before.some((t) => t.id === user.id)).toBe(false);

    const updated = await setUserRole(user.id, "TEACHER");
    expect(updated?.role).toBe("TEACHER");

    const after = await listUsersByRole("TEACHER");
    expect(after.some((t) => t.id === user.id)).toBe(true);
  });

  it("returns null when promoting a user that does not exist", async () => {
    expect(await setUserRole("does-not-exist", "TEACHER")).toBeNull();
  });

  it("deletes a plain student and cascades their enrollments", async () => {
    const teacher = await makeUser("cascade-teacher", "TEACHER");
    const klass = await makeClass(teacher.id, "cascade-class");
    const student = await makeUser("cascade-student", "STUDENT");
    await prisma.enrollment.create({ data: { studentId: student.id, classId: klass.id } });

    const result = await deleteUserAccount(student.id);

    expect(result.status).toBe("DELETED");
    expect(await prisma.user.findUnique({ where: { id: student.id } })).toBeNull();
    expect(await prisma.enrollment.count({ where: { studentId: student.id } })).toBe(0);
  });

  it("refuses to delete a teacher who still owns classes, and leaves them intact", async () => {
    const teacher = await makeUser("owns-class", "TEACHER");
    const klass = await makeClass(teacher.id, "owned-class");

    const blockers = await getUserDeletionBlockers(teacher.id);
    expect(blockers.teachingClasses.map((c) => c.id)).toContain(klass.id);

    const result = await deleteUserAccount(teacher.id);

    expect(result.status).toBe("BLOCKED");
    // The point of the guard: a restrict-FK violation would otherwise surface as
    // an opaque 500, and the account must survive the refusal.
    expect(await prisma.user.findUnique({ where: { id: teacher.id } })).not.toBeNull();
  });

  it("refuses to delete a user who uploaded materials", async () => {
    const teacher = await makeUser("uploader-owner", "TEACHER");
    const klass = await makeClass(teacher.id, "material-class");
    const uploader = await makeUser("uploader", "STUDENT");
    await prisma.material.create({
      data: {
        classId: klass.id,
        title: `${TAG} material`,
        fileUrl: "https://example.com/f.pdf",
        fileSize: 1,
        uploadedBy: uploader.id,
      },
    });

    const result = await deleteUserAccount(uploader.id);

    expect(result.status).toBe("BLOCKED");
    if (result.status === "BLOCKED") {
      expect(result.blockers.uploadedMaterials).toBe(1);
    }
    expect(await prisma.user.findUnique({ where: { id: uploader.id } })).not.toBeNull();
  });

  it("will not delete an ADMIN unless the caller is allowed to, and does not delete first", async () => {
    const admin = await makeUser("peer-admin", "ADMIN");

    const refused = await deleteUserAccount(admin.id);

    expect(refused.status).toBe("FORBIDDEN_ADMIN");
    // Regression guard: an earlier revision checked the target's role AFTER
    // deleting the row, so a non-super admin could remove a peer.
    expect(await prisma.user.findUnique({ where: { id: admin.id } })).not.toBeNull();

    const allowed = await deleteUserAccount(admin.id, { allowDeletingAdmin: true });
    expect(allowed.status).toBe("DELETED");
    expect(await prisma.user.findUnique({ where: { id: admin.id } })).toBeNull();
  });
});
