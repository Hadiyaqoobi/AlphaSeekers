/**
 * Integration tests for the teacher setup checklist, against a REAL Postgres.
 *
 * The checklist exists because a teacher had no way of knowing anything was
 * waiting on them: the scheduler silently skips any class whose teacher has not
 * set availability, so a class assigned in August 2026 sat with zero sessions
 * and nobody was told why. This reports live state, so what it says must match
 * what the scheduler actually acts on.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { getTeacherSetupStatus } from "@/lib/platform/teacher-setup";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "tsetup";
const email = (s: string) => `${TAG}+${s}@example.com`;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${TAG}+` } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.googleAccountLink.deleteMany({ where: { userId: { in: ids } } });
    await prisma.teacherAvailability.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function makeTeacher(slug: string) {
  return prisma.user.create({
    data: { name: `${TAG} ${slug}`, email: email(slug), role: "TEACHER", approvedAt: new Date() },
    select: { id: true },
  });
}

d("teacher setup checklist", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("reports both steps outstanding for a teacher who has done nothing", async () => {
    const teacher = await makeTeacher("fresh");

    const status = await getTeacherSetupStatus(teacher.id);

    expect(status.availabilitySet).toBe(false);
    expect(status.googleConnected).toBe(false);
    expect(status.complete).toBe(false);
  });

  it("ticks off availability and counts the distinct days", async () => {
    const teacher = await makeTeacher("hours");
    // Two rows on the same weekday must not read as two days.
    for (const [day, hour] of [[3, 14], [3, 16], [5, 14]] as const) {
      await prisma.teacherAvailability.create({
        data: {
          teacherId: teacher.id,
          dayOfWeek: day,
          startTimeUTC: new Date(`1970-01-01T${String(hour).padStart(2, "0")}:00:00Z`),
          endTimeUTC: new Date(`1970-01-01T${String(hour + 1).padStart(2, "0")}:00:00Z`),
        },
      });
    }

    const status = await getTeacherSetupStatus(teacher.id);

    expect(status.availabilitySet).toBe(true);
    expect(status.availabilityDays).toBe(2);
    // Google is NOT required: getCalendarClient falls back to the shared
    // platform account, so a teacher who declines to link theirs is not blocked.
    expect(status.googleConnected).toBe(false);
    expect(status.complete).toBe(true);
  });

  it("is complete on availability alone — Google is optional", async () => {
    const teacher = await makeTeacher("both");
    await prisma.teacherAvailability.create({
      data: {
        teacherId: teacher.id,
        dayOfWeek: 1,
        startTimeUTC: new Date("1970-01-01T05:00:00Z"),
        endTimeUTC: new Date("1970-01-01T06:00:00Z"),
      },
    });
    await prisma.googleAccountLink.create({
      data: { userId: teacher.id, googleEmail: "teacher@example.com", accessToken: "x", refreshToken: "y" },
    });

    const status = await getTeacherSetupStatus(teacher.id);

    expect(status.googleConnected).toBe(true);
    expect(status.googleAccountEmail).toBe("teacher@example.com");
    expect(status.complete).toBe(true);
  });

  it("shows the teacher's classes and whether sessions exist yet", async () => {
    const teacher = await makeTeacher("classes");
    const klass = await prisma.class.create({
      data: {
        name: `${TAG} Elementary English`,
        subjectCategory: "English",
        description: "fixture",
        teacherId: teacher.id,
        maxStudents: 150,
        schedulePreference: "7:00 AM to 8:00 AM",
      },
      select: { id: true },
    });

    const before = await getTeacherSetupStatus(teacher.id);
    expect(before.classes).toHaveLength(1);
    expect(before.classes[0].upcomingSessions).toBe(0);

    // A past session must not count as "scheduled" — the teacher needs to know
    // whether anything is coming up, not whether anything ever happened.
    await prisma.session.create({
      data: {
        classId: klass.id,
        startTime: new Date(Date.now() - 3 * 24 * 3600 * 1000),
        endTime: new Date(Date.now() - 3 * 24 * 3600 * 1000 + 3600 * 1000),
      },
    });
    expect((await getTeacherSetupStatus(teacher.id)).classes[0].upcomingSessions).toBe(0);

    await prisma.session.create({
      data: {
        classId: klass.id,
        startTime: new Date(Date.now() + 2 * 24 * 3600 * 1000),
        endTime: new Date(Date.now() + 2 * 24 * 3600 * 1000 + 3600 * 1000),
      },
    });
    expect((await getTeacherSetupStatus(teacher.id)).classes[0].upcomingSessions).toBe(1);
  });
});
