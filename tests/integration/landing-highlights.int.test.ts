/**
 * Integration tests for what the public landing page advertises, against a REAL
 * Postgres.
 *
 * This section is the first thing a visitor arriving from a poster sees, and it
 * is the only place a signed-out visitor can learn a class exists — the class
 * list itself is behind login. So the rules about what may and may not appear
 * here matter: an archived or unpublished class leaking onto the front page
 * would advertise something nobody can join.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { getLandingHighlights } from "@/lib/platform/landing-highlights";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "landing";
const email = (s: string) => `${TAG}+${s}@example.com`;

async function cleanup() {
  await prisma.webinar.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.opportunity.deleteMany({ where: { title: { startsWith: TAG } } });
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${TAG}+` } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function makeTeacher(slug: string) {
  return prisma.user.create({
    data: { name: `${TAG} ${slug}`, email: email(slug), role: "TEACHER", approvedAt: new Date() },
    select: { id: true, name: true },
  });
}

async function makeClass(
  teacherId: string,
  name: string,
  over: { status?: "ACTIVE" | "ARCHIVED"; published?: boolean; maxStudents?: number } = {},
) {
  return prisma.class.create({
    data: {
      name: `${TAG} ${name}`,
      subjectCategory: "English",
      description: "fixture",
      teacherId,
      maxStudents: over.maxStudents ?? 150,
      schedulePreference: "7:00 AM to 8:00 AM, Saturdays to Thursdays",
      status: over.status ?? "ACTIVE",
      published: over.published ?? true,
    },
    select: { id: true },
  });
}

const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

d("landing highlights", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("advertises an open class with the details a visitor needs to decide", async () => {
    const teacher = await makeTeacher("open");
    const klass = await makeClass(teacher.id, "Elementary English", { maxStudents: 150 });

    const { classes } = await getLandingHighlights();
    const found = classes.find((c) => c.id === klass.id);

    expect(found).toBeDefined();
    expect(found?.teacherName).toBe(teacher.name);
    expect(found?.schedulePreference).toContain("7:00 AM");
    expect(found?.seatsLeft).toBe(150);
  });

  it("never advertises an archived or unpublished class", async () => {
    const teacher = await makeTeacher("hidden");
    const archived = await makeClass(teacher.id, "Archived", { status: "ARCHIVED" });
    // `published` is the admin's switch for keeping a class off the public page
    // while it is still being set up.
    const unpublished = await makeClass(teacher.id, "Draft", { published: false });

    const { classes } = await getLandingHighlights();

    expect(classes.some((c) => c.id === archived.id)).toBe(false);
    expect(classes.some((c) => c.id === unpublished.id)).toBe(false);
  });

  it("counts remaining seats rather than capacity", async () => {
    const teacher = await makeTeacher("seats");
    const klass = await makeClass(teacher.id, "Nearly Full", { maxStudents: 3 });
    const student = await prisma.user.create({
      data: { name: `${TAG} s`, email: email("student"), role: "STUDENT", approvedAt: new Date() },
      select: { id: true },
    });
    await prisma.enrollment.create({ data: { classId: klass.id, studentId: student.id } });

    const { classes } = await getLandingHighlights();
    expect(classes.find((c) => c.id === klass.id)?.seatsLeft).toBe(2);
  });

  it("shows only webinars and opportunities that have not passed", async () => {
    const upcoming = await prisma.webinar.create({
      data: { title: `${TAG} Upcoming`, description: "d", startsAt: inDays(5), meetLink: "https://meet.example/x" },
    });
    const past = await prisma.webinar.create({
      data: { title: `${TAG} Past`, description: "d", startsAt: inDays(-5), meetLink: "https://meet.example/y" },
    });
    const openOpp = await prisma.opportunity.create({
      data: { title: `${TAG} Open`, type: "SCHOLARSHIP", description: "d", deadline: inDays(10), externalUrl: "https://example.org/a" },
    });
    const closedOpp = await prisma.opportunity.create({
      data: { title: `${TAG} Closed`, type: "SCHOLARSHIP", description: "d", deadline: inDays(-1), externalUrl: "https://example.org/b" },
    });

    const { webinars, opportunities } = await getLandingHighlights();

    expect(webinars.some((w) => w.id === upcoming.id)).toBe(true);
    expect(webinars.some((w) => w.id === past.id)).toBe(false);
    expect(opportunities.some((o) => o.id === openOpp.id)).toBe(true);
    expect(opportunities.some((o) => o.id === closedOpp.id)).toBe(false);
  });
});
