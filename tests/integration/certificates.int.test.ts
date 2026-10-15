/**
 * Issuing, verifying and cancelling certificates, against a REAL Postgres.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  findCertificateForVerify,
  issueCertificates,
  listClassCertificates,
  listUserCertificates,
  revokeCertificate,
  suggestCertificateDetails,
} from "@/lib/platform/certificates";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "certs";
const email = (s: string) => `${TAG}+${s}@example.com`;

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${TAG}+` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.certificate.deleteMany({ where: { OR: [{ userId: { in: ids } }, { class: { teacherId: { in: ids } } }] } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.certificate.deleteMany({ where: { className: { startsWith: `${TAG} ` } } });
}

async function setup(slug: string) {
  const user = (s: string, role: "TEACHER" | "STUDENT" | "ADMIN") =>
    prisma.user.create({
      data: { name: `${TAG} ${s}`, email: email(`${slug}-${s}`), role, approvedAt: new Date() },
      select: { id: true, name: true },
    });
  const [teacher, staff, a, b, outsider] = await Promise.all([
    user("Teacher", "TEACHER"),
    user("Staff", "ADMIN"),
    user("Amina", "STUDENT"),
    user("Bilal", "STUDENT"),
    user("Outsider", "STUDENT"),
  ]);
  const klass = await prisma.class.create({
    data: {
      name: `${TAG} English ${slug}`,
      subjectCategory: "English",
      description: "fixture",
      teacherId: teacher.id,
      maxStudents: 10,
    },
    select: { id: true, name: true },
  });
  await prisma.enrollment.createMany({
    data: [
      { classId: klass.id, studentId: a.id, status: "ACTIVE" },
      { classId: klass.id, studentId: b.id, status: "ACTIVE" },
    ],
  });
  return { teacher, staff, a, b, outsider, klass };
}

d("certificates", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("issues to the chosen students and the teacher, with the wording copied onto each", async () => {
    const { teacher, staff, a, b, klass } = await setup("issue");

    const result = await issueCertificates({
      classId: klass.id,
      issuedById: staff.id,
      studentIds: [a.id, b.id],
      includeTeacher: true,
      length: " 8-week ",
      term: "Fall 2026",
      hours: "24 hours",
    });

    expect(result).toMatchObject({ ok: true, alreadyHad: 0 });
    if (!result.ok) return;
    expect(result.issued).toHaveLength(3);

    const rows = await listClassCertificates(klass.id);
    const forTeacher = rows.find((r) => r.userId === teacher.id);
    expect(forTeacher).toMatchObject({ kind: "TEACHER_RECOGNITION", detail: "Fall 2026", hours: "24 hours" });
    const forA = rows.find((r) => r.userId === a.id);
    expect(forA).toMatchObject({
      kind: "STUDENT_COMPLETION",
      recipientName: a.name,
      className: klass.name,
      teacherName: teacher.name,
      detail: "8-week",
      hours: null,
    });
  });

  it("never issues a second valid certificate to the same person for the same class", async () => {
    const { staff, a, klass } = await setup("dupe");
    const input = { classId: klass.id, issuedById: staff.id, studentIds: [a.id], includeTeacher: false };

    await issueCertificates(input);
    const again = await issueCertificates(input);

    expect(again).toMatchObject({ ok: true, alreadyHad: 1, issued: [] });
    expect(await prisma.certificate.count({ where: { classId: klass.id } })).toBe(1);
  });

  it("refuses people who are not enrolled in the class", async () => {
    const { staff, outsider, klass } = await setup("outsider");

    const result = await issueCertificates({
      classId: klass.id,
      issuedById: staff.id,
      studentIds: [outsider.id],
      includeTeacher: false,
    });

    expect(result).toEqual({ ok: false, reason: "not-in-class" });
    expect(await prisma.certificate.count({ where: { classId: klass.id } })).toBe(0);
  });

  it("verifies by code, typed in any case, and shows a cancelled one as cancelled", async () => {
    const { staff, a, klass } = await setup("verify");
    const result = await issueCertificates({ classId: klass.id, issuedById: staff.id, studentIds: [a.id], includeTeacher: false });
    if (!result.ok) throw new Error("issue failed");
    const code = result.issued[0].code;

    const found = await findCertificateForVerify(code.toLowerCase());
    expect(found).toMatchObject({ code, recipientName: a.name, revokedAt: null });

    await revokeCertificate(code, "Name was misspelled");
    // The write itself invalidates the public cache: no stale "verified".
    const after = await findCertificateForVerify(code);
    expect(after?.revokedAt).not.toBeNull();
    expect(await listUserCertificates(a.id)).toEqual([]);

    // Once cancelled, the person can be issued a fresh one.
    const reissued = await issueCertificates({ classId: klass.id, issuedById: staff.id, studentIds: [a.id], includeTeacher: false });
    expect(reissued).toMatchObject({ ok: true, alreadyHad: 0 });
    expect(await listUserCertificates(a.id)).toHaveLength(1);
  });

  it("returns nothing for an unknown or malformed code, and keeps the hand-made one", async () => {
    expect(await findCertificateForVerify("AS-2026-ZZZZ-ZZZZ")).toBeNull();
    expect(await findCertificateForVerify("not-a-code")).toBeNull();
    expect(await findCertificateForVerify("AS-TEACH-2026-HN-8F4C")).toMatchObject({ recipientName: "Hadia Noori" });
  });

  it("keeps verifying after the class and the account are deleted", async () => {
    const { staff, a, klass } = await setup("survive");
    const result = await issueCertificates({ classId: klass.id, issuedById: staff.id, studentIds: [a.id], includeTeacher: false });
    if (!result.ok) throw new Error("issue failed");

    await prisma.enrollment.deleteMany({ where: { classId: klass.id } });
    await prisma.class.delete({ where: { id: klass.id } });
    await prisma.user.delete({ where: { id: a.id } });

    expect(await findCertificateForVerify(result.issued[0].code)).toMatchObject({
      recipientName: a.name,
      className: klass.name,
    });
  });

  it("suggests length, term and hours from the sessions actually held", async () => {
    const { klass } = await setup("suggest");
    const start = new Date("2026-09-01T13:00:00Z");
    const week = 7 * 24 * 3600 * 1000;
    await prisma.session.createMany({
      data: [0, 1, 2, 3].map((i) => ({
        classId: klass.id,
        startTime: new Date(start.getTime() + i * week),
        endTime: new Date(start.getTime() + i * week + 90 * 60000),
      })),
    });
    // A cancelled session and a future one do not count.
    await prisma.session.create({
      data: { classId: klass.id, startTime: new Date("2026-09-30T13:00:00Z"), endTime: new Date("2026-09-30T14:00:00Z"), cancelled: true },
    });

    expect(await suggestCertificateDetails(klass.id, new Date("2026-10-01T00:00:00Z"))).toEqual({
      length: "4-week",
      term: "September 2026",
      hours: "6 hours",
    });
  });
});
