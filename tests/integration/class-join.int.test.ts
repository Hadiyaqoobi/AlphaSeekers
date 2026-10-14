/**
 * One-step class join, against a REAL Postgres.
 *
 * This endpoint is PUBLIC and creates accounts, so the tests below are less
 * about the happy path than about the ways it could be abused: joining as
 * somebody else, reviving a disabled account, joining a class that was never
 * published, or taking a seat that does not exist.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { getPublicClassForJoin, joinClassWithNewAccount } from "@/lib/platform/class-join";
import { hashPassword } from "@/lib/security/passwords";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "classjoin";
const email = (s: string) => `${TAG}+${s}@example.com`;
const GOOD = "Passw0rd123";

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

async function makeClass(
  slug: string,
  opts: { published?: boolean; maxStudents?: number; archived?: boolean; joinQuestions?: object[] } = {},
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
      status: opts.archived ? "ARCHIVED" : "ACTIVE",
      ...(opts.joinQuestions ? { joinQuestions: opts.joinQuestions } : {}),
    },
    select: { id: true },
  });
}

d("one-step class join", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("creates the account AND puts them in the class in one call", async () => {
    const klass = await makeClass("happy");

    const result = await joinClassWithNewAccount({
      classId: klass.id,
      name: "Zahra N",
      email: email("new"),
      password: GOOD,
    });

    expect(result).toMatchObject({ ok: true, created: true, alreadyEnrolled: false });

    // ACTIVE, not PENDING — the whole point is no admin in the middle.
    const enrollment = await prisma.enrollment.findFirst({
      where: { class: { id: klass.id } },
      select: { status: true },
    });
    expect(enrollment?.status).toBe("ACTIVE");

    // And the account is immediately usable, not awaiting approval.
    const user = await prisma.user.findUnique({
      where: { email: email("new") },
      select: { role: true, approvedAt: true, passwordHash: true },
    });
    expect(user?.role).toBe("STUDENT");
    expect(user?.approvedAt).not.toBeNull();
    expect(user?.passwordHash).toBeTruthy();
  });

  it("lets a returning student join with their existing password", async () => {
    await prisma.user.create({
      data: {
        name: "Returning",
        email: email("returning"),
        role: "STUDENT",
        approvedAt: new Date(),
        passwordHash: await hashPassword(GOOD),
      },
    });
    const klass = await makeClass("returning");

    const result = await joinClassWithNewAccount({
      classId: klass.id,
      name: "Returning",
      email: email("returning"),
      password: GOOD,
    });

    expect(result).toMatchObject({ ok: true, created: false });
  });

  it("REFUSES to enrol anyone when the password is wrong", async () => {
    // Otherwise this public endpoint would enrol people into classes using
    // somebody else's email address.
    await prisma.user.create({
      data: {
        name: "Victim",
        email: email("victim"),
        role: "STUDENT",
        approvedAt: new Date(),
        passwordHash: await hashPassword(GOOD),
      },
    });
    const klass = await makeClass("victim");

    const result = await joinClassWithNewAccount({
      classId: klass.id,
      name: "Attacker",
      email: email("victim"),
      password: "WrongPassword9",
    });

    expect(result).toEqual({ ok: false, code: "WRONG_PASSWORD" });
    expect(await prisma.enrollment.count({ where: { classId: klass.id } })).toBe(0);
  });

  it("refuses a deactivated account", async () => {
    await prisma.user.create({
      data: {
        name: "Gone",
        email: email("gone"),
        role: "STUDENT",
        approvedAt: new Date(),
        deactivatedAt: new Date(),
        passwordHash: await hashPassword(GOOD),
      },
    });
    const klass = await makeClass("gone");

    const result = await joinClassWithNewAccount({
      classId: klass.id,
      name: "Gone",
      email: email("gone"),
      password: GOOD,
    });
    // Same answer a staff account gets, and only after the password matched
    // (see security-access.int.test.ts) — never a hint about the account.
    expect(result).toEqual({ ok: false, code: "USE_SIGN_IN" });
  });

  it("refuses an unpublished or archived class", async () => {
    const unpublished = await makeClass("draft", { published: false });
    const archived = await makeClass("old", { archived: true });

    for (const klass of [unpublished, archived]) {
      const result = await joinClassWithNewAccount({
        classId: klass.id,
        name: "Someone",
        email: email(`x-${klass.id.slice(0, 6)}`),
        password: GOOD,
      });
      expect(result).toEqual({ ok: false, code: "CLASS_CLOSED" });
    }
  });

  it("respects capacity", async () => {
    const klass = await makeClass("tiny", { maxStudents: 1 });

    const first = await joinClassWithNewAccount({
      classId: klass.id, name: "First", email: email("first"), password: GOOD,
    });
    expect(first.ok).toBe(true);

    const second = await joinClassWithNewAccount({
      classId: klass.id, name: "Second", email: email("second"), password: GOOD,
    });
    expect(second).toEqual({ ok: false, code: "CLASS_FULL" });
  });

  it("is idempotent — submitting twice does not duplicate anything", async () => {
    // A slow connection makes double-tapping Submit very likely.
    const klass = await makeClass("double");
    const input = { classId: klass.id, name: "Twice", email: email("twice"), password: GOOD };

    await joinClassWithNewAccount(input);
    const again = await joinClassWithNewAccount(input);

    expect(again).toMatchObject({ ok: true, alreadyEnrolled: true });
    expect(await prisma.enrollment.count({ where: { classId: klass.id } })).toBe(1);
    expect(await prisma.user.count({ where: { email: email("twice") } })).toBe(1);
  });

  it("hides unpublished classes from the public join page", async () => {
    const draft = await makeClass("hidden", { published: false });
    expect(await getPublicClassForJoin(draft.id)).toBeNull();
    // And a made-up id reveals nothing either.
    expect(await getPublicClassForJoin("does-not-exist")).toBeNull();
  });
});

d("legacy pending students", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("a student stuck in PENDING is admitted when they try again", async () => {
    // Real students were left in PENDING when joining stopped requiring
    // approval. Nothing watches that queue any more, so "you have already
    // asked, keep waiting" would have stranded them for good.
    const { enrollStudentInClass } = await import("@/lib/platform/db-store");
    const klass = await makeClass("stranded");
    const student = await prisma.user.create({
      data: {
        name: "Waiting since forever",
        email: email("stranded"),
        role: "STUDENT",
        approvedAt: new Date(),
        passwordHash: await hashPassword(GOOD),
      },
      select: { id: true },
    });
    await prisma.enrollment.create({
      data: { studentId: student.id, classId: klass.id, status: "PENDING" },
    });

    const result = await enrollStudentInClass(student.id, klass.id);
    expect(result.state).toBe("JOINED");

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: student.id, classId: klass.id },
      select: { status: true },
    });
    expect(enrollment?.status).toBe("ACTIVE");
  });

  it("a REJECTED student is still kept out", async () => {
    // The one human decision that still overrides immediate joining.
    const { enrollStudentInClass } = await import("@/lib/platform/db-store");
    const klass = await makeClass("removed");
    const student = await prisma.user.create({
      data: {
        name: "Removed",
        email: email("removed"),
        role: "STUDENT",
        approvedAt: new Date(),
        passwordHash: await hashPassword(GOOD),
      },
      select: { id: true },
    });
    await prisma.enrollment.create({
      data: { studentId: student.id, classId: klass.id, status: "REJECTED" },
    });

    await expect(enrollStudentInClass(student.id, klass.id)).rejects.toThrow("Enrollment rejected");
  });

  describe("the class's own sign-up questions (ADR-0009)", () => {
    const QUESTIONS = [
      { id: "phone", kind: "phone", type: "short", required: true },
      { id: "englishLevel", kind: "englishLevel", type: "choice", options: ["beginner", "intermediate", "advanced"], required: false },
      { id: "q1", kind: "custom", type: "short", label: "Which city?", required: false },
    ];

    it("saves the answers with the enrolment, phone encrypted at rest, readable by staff", async () => {
      const { listClassEnrollments } = await import("@/lib/platform/db-store");
      const klass = await makeClass("answers", { joinQuestions: QUESTIONS });

      const result = await joinClassWithNewAccount({
        classId: klass.id,
        name: "Answering Student",
        email: email("answers"),
        password: GOOD,
        answers: { phone: "۰۷۰۰ ۱۲۳ ۴۵۶", englishLevel: "beginner", q1: "Herat", notAsked: "x" },
      });
      expect(result).toMatchObject({ ok: true, created: true });

      const stored = await prisma.enrollment.findFirst({ where: { classId: klass.id }, select: { answers: true } });
      const raw = stored?.answers as Record<string, string>;
      expect(raw.englishLevel).toBe("beginner");
      expect(raw.notAsked).toBeUndefined();
      // Not the plain number: encrypted (or the dev "plain:" marker without a key).
      expect(raw.phone).not.toBe("0700 123 456");

      const [row] = await listClassEnrollments(klass.id);
      expect(row.answers).toEqual({ phone: "0700 123 456", englishLevel: "beginner", q1: "Herat" });
    });

    it("refuses a missing required answer BEFORE creating any account", async () => {
      const klass = await makeClass("missing", { joinQuestions: QUESTIONS });

      const result = await joinClassWithNewAccount({
        classId: klass.id,
        name: "No Phone",
        email: email("nophone"),
        password: GOOD,
        answers: { englishLevel: "beginner" },
      });

      expect(result).toEqual({ ok: false, code: "INVALID_ANSWERS", questionId: "phone" });
      expect(await prisma.user.count({ where: { email: email("nophone") } })).toBe(0);
    });

    it("a signed-in student cannot skip the questions with the in-app join", async () => {
      const { enrollStudentInClass, InvalidAnswersError } = await import("@/lib/platform/db-store");
      const klass = await makeClass("inapp", { joinQuestions: QUESTIONS });
      const student = await prisma.user.create({
        data: { name: "In App", email: email("inapp"), role: "STUDENT", approvedAt: new Date() },
        select: { id: true },
      });

      await expect(enrollStudentInClass(student.id, klass.id)).rejects.toBeInstanceOf(InvalidAnswersError);
      expect(await prisma.enrollment.count({ where: { classId: klass.id } })).toBe(0);

      const joined = await enrollStudentInClass(student.id, klass.id, { phone: "+93 700 123 456" });
      expect(joined.state).toBe("JOINED");
      // The stored (encrypted) answers are not sent back to the browser.
      expect(joined.enrollment).not.toHaveProperty("answers");
    });

    it("the public join page shows the questions and the deadline, never answers", async () => {
      const klass = await makeClass("summary", { joinQuestions: QUESTIONS });
      await prisma.class.update({ where: { id: klass.id }, data: { registrationDeadline: new Date(Date.now() - 60_000) } });

      const summary = await getPublicClassForJoin(klass.id);
      expect(summary?.questions.map((q) => q.id)).toEqual(["phone", "englishLevel", "q1"]);
      expect(summary?.registrationDeadline).not.toBeNull();
    });

    it("posting a class through the real create path saves its questions", async () => {
      const { createClassFromBody, parseCreateClassBody } = await import("@/lib/platform/class-create");
      const teacher = await prisma.user.create({
        data: { name: `${TAG} t-post`, email: email("t-post"), role: "TEACHER", approvedAt: new Date() },
        select: { id: true },
      });
      const parsed = parseCreateClassBody({
        name: `${TAG} posted`,
        subjectCategory: "English",
        description: "fixture",
        teacherId: teacher.id,
        day: "Wed",
        time: "18:00",
        schedulingMode: "MANUAL",
        joinQuestions: QUESTIONS,
      });
      if (!parsed.ok) throw new Error(parsed.body.message);

      const created = await createClassFromBody(parsed.data);
      if (!created.ok) throw new Error(created.message);
      const row = await prisma.class.findUnique({
        where: { id: created.result.class.id },
        select: { joinQuestions: true },
      });
      expect((row?.joinQuestions as Array<{ id: string }>).map((q) => q.id)).toEqual(["phone", "englishLevel", "q1"]);
    });

    it("editing a class to no questions clears them", async () => {
      const { updateClass } = await import("@/lib/platform/db-store");
      const klass = await makeClass("clear", { joinQuestions: QUESTIONS });

      await updateClass(klass.id, { joinQuestions: [] });
      const after = await prisma.class.findUnique({ where: { id: klass.id }, select: { joinQuestions: true } });
      expect(after?.joinQuestions).toBeNull();
    });
  });
});
