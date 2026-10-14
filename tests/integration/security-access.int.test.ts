/**
 * Access-control fixes at the data layer, against a REAL Postgres.
 *
 *  S1  the class list never carries a Meet link, and hides unpublished classes
 *  S2  class detail: no check-in codes / Google ids, and UPCOMING sessions
 *  S3  a teacher's removal sticks; a student's own leave does not
 *  S5  unpublished classes cannot be joined from inside the platform
 *  S7  a password change revokes tokens issued before it
 *  S8  the public join form checks the password before saying anything
 *  S19 the public join takes the seat lock, applies the class cap, and emits
 *      the welcome event
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import type { JWT } from "next-auth/jwt";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { authOptions } from "@/lib/auth";
import { joinClassWithNewAccount, MAX_ACTIVE_ENROLLMENTS } from "@/lib/platform/class-join";
import {
  dropStudentFromClass,
  enrollStudentInClass,
  getClassById,
  listClasses,
} from "@/lib/platform/db-store";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/passwords";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "secfix";
const email = (s: string) => `${TAG}+${s}@example.com`;
const GOOD = "Passw0rd123";
const HOUR = 60 * 60 * 1000;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${TAG}+` } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await prisma.job.deleteMany({ where: { dedupeKey: { startsWith: "student.enrolled:" } } });
  if (ids.length) {
    await prisma.enrollment.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function makeClass(
  slug: string,
  opts: { published?: boolean; maxStudents?: number } = {},
) {
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
      maxStudents: opts.maxStudents ?? 10,
      published: opts.published ?? true,
    },
    select: { id: true, teacherId: true },
  });
}

async function makeStudent(slug: string, extra: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: {
      name: `${TAG} s-${slug}`,
      email: email(`s-${slug}`),
      role: "STUDENT",
      approvedAt: new Date(),
      passwordHash: await hashPassword(GOOD),
      ...extra,
    },
    select: { id: true, email: true },
  });
}

async function addSession(classId: string, startOffsetMs: number, extra: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + startOffsetMs);
  return prisma.session.create({
    data: {
      classId,
      startTime: start,
      endTime: new Date(start.getTime() + HOUR),
      meetLink: `https://meet.google.com/${TAG}-${Math.abs(startOffsetMs)}`,
      ...extra,
    },
    select: { id: true },
  });
}

d("S1: class list", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("never includes a Meet link, and omits unpublished classes", async () => {
    const open = await makeClass("list-open");
    const hidden = await makeClass("list-hidden", { published: false });
    await addSession(open.id, 2 * HOUR);
    await addSession(hidden.id, 2 * HOUR);

    const result = await listClasses({ search: `${TAG} list`, limit: 50 });
    const ids = result.items.map((item) => item.id);

    expect(ids).toContain(open.id);
    expect(ids).not.toContain(hidden.id);
    const item = result.items.find((i) => i.id === open.id)!;
    expect(item.nextSessionStart).not.toBeNull();
    expect(item).not.toHaveProperty("meetLink");
    expect(JSON.stringify(result)).not.toContain("meet.google.com");
  });
});

d("S2: class detail", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("never returns check-in codes or Google event ids", async () => {
    const klass = await makeClass("detail-codes");
    await addSession(klass.id, 30 * 60 * 1000, {
      checkinCode: "4321",
      checkinCodeExpiresAt: new Date(Date.now() + HOUR),
      googleEventId: "evt-secret",
      googleCalendarId: "cal-secret",
    });

    const record = await getClassById(klass.id);
    expect(record?.sessions).toHaveLength(1);
    const session = record!.sessions[0] as Record<string, unknown>;
    for (const field of ["checkinCode", "checkinCodeExpiresAt", "googleEventId", "googleCalendarId"]) {
      expect(session, field).not.toHaveProperty(field);
    }
    expect(JSON.stringify(record)).not.toContain("4321");
  });

  it("returns UPCOMING sessions soonest-first, keeping one in progress", async () => {
    const klass = await makeClass("detail-upcoming");
    // Ten old sessions used to fill the list ahead of today's.
    for (let day = 1; day <= 10; day += 1) {
      await addSession(klass.id, -day * 24 * HOUR);
    }
    const inProgress = await addSession(klass.id, -30 * 60 * 1000);
    const later = await addSession(klass.id, 48 * HOUR);
    const soon = await addSession(klass.id, 2 * HOUR);

    const record = await getClassById(klass.id);
    expect(record!.sessions.map((s) => s.id)).toEqual([inProgress.id, soon.id, later.id]);
    expect(record!.sessions[0].meetLink).toContain("meet.google.com");
    // The all-time total is still available for the admin stats tile.
    expect(record!.sessionCount).toBe(13);
  });

  it("hides an unpublished class unless the caller opts in", async () => {
    const klass = await makeClass("detail-hidden", { published: false });
    expect(await getClassById(klass.id)).toBeNull();
    const optedIn = await getClassById(klass.id, { includeUnpublished: true });
    expect(optedIn?.published).toBe(false);
    expect(await getClassById(klass.id, { includeArchived: true })).not.toBeNull();
  });
});

d("S3/S5: removal and unpublished classes", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("a teacher's removal blocks rejoining by either door", async () => {
    const klass = await makeClass("removed");
    const student = await makeStudent("removed");
    await enrollStudentInClass(student.id, klass.id);

    const removed = await dropStudentFromClass(student.id, klass.id, { by: "staff" });
    expect(removed?.status).toBe("REJECTED");

    await expect(enrollStudentInClass(student.id, klass.id)).rejects.toThrow("Enrollment rejected");
    const viaJoin = await joinClassWithNewAccount({
      classId: klass.id,
      name: "Removed",
      email: student.email,
      password: GOOD,
    });
    expect(viaJoin).toEqual({ ok: false, code: "NOT_ALLOWED" });

    // "Leaving" cannot launder REJECTED into DROPPED.
    expect(await dropStudentFromClass(student.id, klass.id, { by: "self" })).toBeNull();
    const row = await prisma.enrollment.findFirst({
      where: { studentId: student.id, classId: klass.id },
      select: { status: true },
    });
    expect(row?.status).toBe("REJECTED");
  });

  it("a student who LEFT may come back", async () => {
    const klass = await makeClass("left");
    const student = await makeStudent("left");
    await enrollStudentInClass(student.id, klass.id);

    const left = await dropStudentFromClass(student.id, klass.id, { by: "self" });
    expect(left?.status).toBe("DROPPED");
    const again = await enrollStudentInClass(student.id, klass.id);
    expect(again.state).toBe("JOINED");
  });

  it("refuses an unpublished class from inside the platform", async () => {
    const klass = await makeClass("unpublished", { published: false });
    const student = await makeStudent("unpublished");
    await expect(enrollStudentInClass(student.id, klass.id)).rejects.toThrow("Class not found");
  });
});

d("S8: public join reveals nothing before the password", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("a staff address with a wrong password looks like any wrong password", async () => {
    const klass = await makeClass("staffcheck");
    await prisma.user.create({
      data: {
        name: "Staff",
        email: email("staff"),
        role: "ADMIN",
        approvedAt: new Date(),
        passwordHash: await hashPassword(GOOD),
      },
    });
    await makeStudent("deact", { deactivatedAt: new Date() });

    for (const address of [email("staff"), email("s-deact")]) {
      const wrong = await joinClassWithNewAccount({
        classId: klass.id,
        name: "x",
        email: address,
        password: "NotIt12345",
      });
      expect(wrong, address).toEqual({ ok: false, code: "WRONG_PASSWORD" });

      // With the right password the owner is told to sign in — one answer for
      // both, and nobody is enrolled.
      const right = await joinClassWithNewAccount({
        classId: klass.id,
        name: "x",
        email: address,
        password: GOOD,
      });
      expect(right, address).toEqual({ ok: false, code: "USE_SIGN_IN" });
    }
    expect(await prisma.enrollment.count({ where: { classId: klass.id } })).toBe(0);
  });
});

d("S19: public join matches the in-app enroll", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("concurrent joins cannot oversell the last seat", async () => {
    const klass = await makeClass("lastseat", { maxStudents: 1 });
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        joinClassWithNewAccount({
          classId: klass.id,
          name: `Racer ${i}`,
          email: email(`race-${i}`),
          password: GOOD,
        }),
      ),
    );
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(
      await prisma.enrollment.count({ where: { classId: klass.id, status: "ACTIVE" } }),
    ).toBe(1);
  });

  it("applies the cap on simultaneous classes", async () => {
    const student = await makeStudent("busy");
    for (let i = 0; i < MAX_ACTIVE_ENROLLMENTS; i += 1) {
      const k = await makeClass(`busy-${i}`);
      await enrollStudentInClass(student.id, k.id);
    }
    const extra = await makeClass("busy-extra");
    const result = await joinClassWithNewAccount({
      classId: extra.id,
      name: "Busy",
      email: student.email,
      password: GOOD,
    });
    expect(result).toEqual({ ok: false, code: "ENROLLMENT_LIMIT" });
  });

  it("emits student.enrolled so the teacher and student are notified", async () => {
    const klass = await makeClass("welcome");
    const result = await joinClassWithNewAccount({
      classId: klass.id,
      name: "Welcome",
      email: email("welcome"),
      password: GOOD,
    });
    expect(result.ok).toBe(true);

    const enrollment = await prisma.enrollment.findFirstOrThrow({
      where: { classId: klass.id },
      select: { id: true },
    });
    const jobs = await prisma.job.findMany({
      where: { dedupeKey: { startsWith: `student.enrolled:${enrollment.id}:` } },
      select: { type: true, payload: true },
    });
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0].payload).toMatchObject({ event: "student.enrolled", classId: klass.id });
  });
});

d("S7: password change revokes older sessions", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  const jwt = authOptions.callbacks!.jwt!;
  const recheck = (token: JWT) =>
    jwt({ token, user: undefined as never, account: null, trigger: "update" } as never) as Promise<JWT>;

  it("revokes a token issued before the change, keeps one issued after", async () => {
    const student = await makeStudent("pwd");

    // Before any change: an old token (no stamp at all) is fine.
    const untouched = await recheck({ sub: student.id, role: "STUDENT", lastValidatedAt: 0 });
    expect(untouched.sub).toBe(student.id);

    const changedAt = new Date();
    await prisma.user.update({ where: { id: student.id }, data: { passwordChangedAt: changedAt } });

    const stale = await recheck({ sub: student.id, role: "STUDENT", pwdAt: 0, lastValidatedAt: 0 });
    expect(stale.sub).toBeUndefined();
    expect((stale as Record<string, unknown>).revoked).toBe(true);

    const fresh = await recheck({
      sub: student.id,
      role: "STUDENT",
      pwdAt: changedAt.getTime(),
      lastValidatedAt: 0,
    });
    expect(fresh.sub).toBe(student.id);
  });
});
