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

async function makeClass(slug: string, opts: { published?: boolean; maxStudents?: number; archived?: boolean } = {}) {
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
    expect(result).toEqual({ ok: false, code: "ACCOUNT_DEACTIVATED" });
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
