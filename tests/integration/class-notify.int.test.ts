/**
 * Integration tests for the "a class was assigned to you" message, against a
 * REAL Postgres.
 *
 * Creating a class from the admin screen used to trigger nothing: the teacher
 * was never told, so they never set availability, so the scheduler skipped the
 * class forever. Two English classes were advertised publicly in August 2026
 * with zero sessions for exactly this reason.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { createClass } from "@/lib/platform/db-store";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "clsnotify";
const email = (s: string) => `${TAG}+${s}@example.com`;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${TAG}+` } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.teacherAvailability.deleteMany({ where: { teacherId: { in: ids } } });
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

function newClassInput(teacherId: string, over: Record<string, unknown> = {}) {
  return {
    name: `${TAG} Elementary English`,
    subjectCategory: "English",
    description: "fixture",
    teacherId,
    maxStudents: 150,
    durationMinutes: 60,
    schedulePreference: "7:00 AM to 8:00 AM, Saturdays to Thursdays",
    ...over,
  } as Parameters<typeof createClass>[0];
}

d("new class notifies its teacher", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("messages the teacher with both setup steps when a class is created", async () => {
    const teacher = await makeTeacher("assigned");

    const klass = await createClass(newClassInput(teacher.id));

    const notes = await prisma.notification.findMany({ where: { userId: teacher.id } });
    expect(notes.length).toBeGreaterThan(0);

    const body = notes[0].content;
    expect(body).toContain(klass.name);
    // Both steps must be named, or the teacher does half the setup and the class
    // still cannot run. They are reached through the setup checklist, which
    // shows live status rather than repeating instructions.
    expect(body).toMatch(/hours you can teach/i);
    expect(body).toContain("/en/teacher/setup");
    // Google must be described as optional: the Meet integration falls back to
    // the shared platform account, so a teacher who declines is not blocked.
    expect(body).toMatch(/optional/i);
    expect(body).toContain("7:00 AM to 8:00 AM, Saturdays to Thursdays");
  });

  it("does not invent a session at a guessed time", async () => {
    const teacher = await makeTeacher("no-guess");

    const klass = await createClass(newClassInput(teacher.id));

    // Regression guard: createClassWithSession() parses the free-text schedule
    // preference and books a session even when the teacher has set no
    // availability. The scheduler deliberately refuses to do that
    // (QA 2026-04-19), so the admin path must not do it either.
    expect(await prisma.session.count({ where: { classId: klass.id } })).toBe(0);
  });

  it("returns the created class even when the teacher has no reachable channel", async () => {
    // No phone, no Telegram, no push, and SMTP is unset in tests — so email
    // delivery genuinely fails here. Class creation must not be coupled to it:
    // losing the class row over an undelivered message would be far worse than
    // a message the admin can resend.
    const teacher = await prisma.user.create({
      data: { name: `${TAG} unreachable`, email: email("unreachable"), role: "TEACHER" },
      select: { id: true },
    });

    const klass = await createClass(newClassInput(teacher.id, { name: `${TAG} Resilient` }));

    expect(klass.id).toBeTruthy();
    expect(await prisma.class.findUnique({ where: { id: klass.id } })).not.toBeNull();
  });
});
