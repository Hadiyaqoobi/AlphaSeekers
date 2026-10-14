/**
 * A teacher's own dashboard numbers, and the saved hours the class form shows,
 * against a REAL Postgres.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { getTeacherDashboardStats, loadAvailabilityByTeacher } from "@/lib/platform/db-store";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "tdash";
const email = (s: string) => `${TAG}+${s}@example.com`;
const HOUR = 60 * 60 * 1000;

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${TAG}+` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.teacherAvailability.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { OR: [{ studentId: { in: ids } }, { class: { teacherId: { in: ids } } }] } });
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

const user = (slug: string, role: "TEACHER" | "STUDENT") =>
  prisma.user.create({
    data: { name: `${TAG} ${slug}`, email: email(slug), role, approvedAt: new Date() },
    select: { id: true },
  });

const klass = (teacherId: string, slug: string, status: "ACTIVE" | "ARCHIVED" = "ACTIVE") =>
  prisma.class.create({
    data: { name: `${TAG} ${slug}`, subjectCategory: "English", description: "x", teacherId, maxStudents: 10, status },
    select: { id: true },
  });

d("teacher dashboard", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("counts only this teacher's active classes, distinct students and upcoming sessions", async () => {
    const teacher = await user("t", "TEACHER");
    const other = await user("other", "TEACHER");
    const [a, b] = [await klass(teacher.id, "a"), await klass(teacher.id, "b")];
    await klass(teacher.id, "archived", "ARCHIVED");
    const theirs = await klass(other.id, "theirs");

    const s1 = await user("s1", "STUDENT");
    const s2 = await user("s2", "STUDENT");
    await prisma.enrollment.createMany({
      data: [
        { classId: a.id, studentId: s1.id, status: "ACTIVE" },
        { classId: b.id, studentId: s1.id, status: "ACTIVE" }, // same person, counted once
        { classId: b.id, studentId: s2.id, status: "DROPPED" }, // left, not counted
        { classId: theirs.id, studentId: s2.id, status: "ACTIVE" }, // another teacher's
      ],
    });

    const now = new Date("2026-10-14T06:00:00Z"); // 10:30 in Kabul
    await prisma.session.createMany({
      data: [
        { classId: a.id, startTime: new Date(now.getTime() + 2 * HOUR), endTime: new Date(now.getTime() + 3 * HOUR) },
        { classId: b.id, startTime: new Date(now.getTime() + 3 * 24 * HOUR), endTime: new Date(now.getTime() + 3 * 24 * HOUR + HOUR) },
        { classId: b.id, startTime: new Date(now.getTime() + 4 * HOUR), endTime: new Date(now.getTime() + 5 * HOUR), cancelled: true },
        { classId: theirs.id, startTime: new Date(now.getTime() + HOUR), endTime: new Date(now.getTime() + 2 * HOUR) },
      ],
    });

    expect(await getTeacherDashboardStats(teacher.id, now)).toEqual({
      activeClasses: 2,
      students: 1,
      sessionsToday: 1,
      sessionsThisWeek: 2,
    });
  });

  it("loads saved hours per teacher in Kabul minutes, ordered by day", async () => {
    const teacher = await user("hours", "TEACHER");
    const none = await user("nohours", "TEACHER");
    const at = (minute: number) => new Date(Date.UTC(1970, 0, 1, 0, minute));
    await prisma.teacherAvailability.createMany({
      data: [
        { teacherId: teacher.id, dayOfWeek: 3, startTimeUTC: at(1170), endTimeUTC: at(1290) },
        { teacherId: teacher.id, dayOfWeek: 1, startTimeUTC: at(540), endTimeUTC: at(600) },
      ],
    });

    const byTeacher = await loadAvailabilityByTeacher([teacher.id, none.id]);
    expect(byTeacher[teacher.id]).toEqual([
      { dayOfWeek: 1, startMinute: 540, endMinute: 600 },
      { dayOfWeek: 3, startMinute: 1170, endMinute: 1290 },
    ]);
    expect(byTeacher[none.id]).toBeUndefined();
  });
});
