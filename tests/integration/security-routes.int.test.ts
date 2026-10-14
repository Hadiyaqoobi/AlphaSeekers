/**
 * Route-level security fixes, against a REAL Postgres with the session mocked.
 *
 *  S6  scoped employees (role ADMIN without the class permission) are not
 *      class staff
 *  S9  upload presign: content-type allowlist, per-class authorisation
 *  S11 "I attended" only during the live window; teachers mark only students
 *      who are in the class
 *  S15 deleting your account really switches it off
 *  S4  forgot-password does not re-issue within two minutes
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/security/session";

const state = vi.hoisted(() => ({ user: null as SessionUser | null }));

vi.mock("@/lib/security/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/session")>();
  return { ...actual, getSessionUser: vi.fn(async () => state.user) };
});

vi.mock("@/lib/integrations/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations/notifications")>();
  return { ...actual, sendPasswordResetEmail: vi.fn(async () => undefined) };
});

import { DELETE as deleteAccount } from "@/app/api/me/account/route";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { GET as getClass } from "@/app/api/classes/[id]/route";
import { POST as attend } from "@/app/api/classes/[id]/sessions/[sessionId]/attend/route";
import { GET as getCheckinCode } from "@/app/api/classes/[id]/sessions/[sessionId]/checkin-code/route";
import { POST as markSessionAttendance } from "@/app/api/classes/sessions/[sessionId]/attendance/route";
import { POST as presign } from "@/app/api/uploads/presign/route";
import { prisma } from "@/lib/prisma";
import { permissionsForLevel } from "@/lib/security/permissions";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "secroute";
const email = (s: string) => `${TAG}+${s}@example.com`;
const HOUR = 60 * 60 * 1000;

function as(user: { id: string; role: SessionUser["role"] }) {
  state.user = { id: user.id, role: user.role, approved: true, email: null, name: null };
}

function req(url: string, body?: unknown, method = "POST") {
  return new NextRequest(`http://localhost${url}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.50" },
  });
}

// Account deletion rewrites the email, so track rows by id, not address.
const created: string[] = [];

async function cleanup() {
  state.user = null;
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { startsWith: `${TAG}+` } }, { id: { in: created } }] },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  created.length = 0;
  if (ids.length) {
    await prisma.passwordReset.deleteMany({ where: { userId: { in: ids } } });
    await prisma.attendance.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function user(slug: string, role: SessionUser["role"], extra: Record<string, unknown> = {}) {
  const row = await prisma.user.create({
    data: { name: `${TAG} ${slug}`, email: email(slug), role, approvedAt: new Date(), ...extra },
    select: { id: true, role: true, email: true },
  });
  created.push(row.id);
  return row;
}

async function classWithSession(slug: string, startOffsetMs: number) {
  const teacher = await user(`t-${slug}`, "TEACHER");
  const klass = await prisma.class.create({
    data: {
      name: `${TAG} ${slug}`,
      subjectCategory: "English",
      description: "fixture",
      teacherId: teacher.id,
      maxStudents: 10,
    },
    select: { id: true },
  });
  const start = new Date(Date.now() + startOffsetMs);
  const session = await prisma.session.create({
    data: {
      classId: klass.id,
      startTime: start,
      endTime: new Date(start.getTime() + HOUR),
      meetLink: "https://meet.google.com/secroute",
      checkinCode: "2468",
      checkinCodeExpiresAt: new Date(Date.now() + HOUR),
    },
    select: { id: true },
  });
  return { teacher, klass, session };
}

d("S6: scoped employees are not class staff", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("a moderator gets the public view of a class and no check-in code", async () => {
    const { klass, session } = await classWithSession("scoped", 10 * 60 * 1000);
    const moderator = await user("moderator", "ADMIN", {
      accessLevel: "MODERATOR",
      permissions: permissionsForLevel("MODERATOR"),
    });
    as(moderator);

    const detail = await getClass(new Request("http://localhost"), { params: { id: klass.id } });
    const body = (await detail.json()) as { sessions: Array<{ meetLink: string | null }> };
    expect(detail.status).toBe(200);
    expect(body.sessions[0].meetLink).toBeNull();

    const code = await getCheckinCode(req("/x", undefined, "GET"), {
      params: { id: klass.id, sessionId: session.id },
    });
    expect(code.status).toBe(403);
  });

  it("support staff (classes.view) do see the private details", async () => {
    const { klass } = await classWithSession("support", 10 * 60 * 1000);
    const support = await user("support", "ADMIN", {
      accessLevel: "SUPPORT",
      permissions: permissionsForLevel("SUPPORT"),
    });
    as(support);

    const detail = await getClass(new Request("http://localhost"), { params: { id: klass.id } });
    const body = (await detail.json()) as { sessions: Array<{ meetLink: string | null }> };
    expect(body.sessions[0].meetLink).toContain("meet.google.com");
  });
});

d("S11: attendance", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("a student cannot mark attendance for a session long past", async () => {
    const { klass, session } = await classWithSession("past", -2 * 24 * HOUR);
    const student = await user("past-student", "STUDENT");
    await prisma.enrollment.create({ data: { studentId: student.id, classId: klass.id, status: "ACTIVE" } });
    as(student);

    const res = await attend(new Request("http://localhost", { method: "POST" }), {
      params: { id: klass.id, sessionId: session.id },
    });
    expect(res.status).toBe(403);
    expect(await prisma.attendance.count({ where: { sessionId: session.id } })).toBe(0);
  });

  it("but can during the live window", async () => {
    const { klass, session } = await classWithSession("live", -10 * 60 * 1000);
    const student = await user("live-student", "STUDENT");
    await prisma.enrollment.create({ data: { studentId: student.id, classId: klass.id, status: "ACTIVE" } });
    as(student);

    const res = await attend(new Request("http://localhost", { method: "POST" }), {
      params: { id: klass.id, sessionId: session.id },
    });
    expect(res.status).toBe(200);
  });

  it("a teacher can only mark students who are in the class", async () => {
    const { teacher, klass, session } = await classWithSession("roster", 0);
    const outsider = await user("outsider", "STUDENT");
    const member = await user("member", "STUDENT");
    await prisma.enrollment.create({ data: { studentId: member.id, classId: klass.id, status: "ACTIVE" } });
    as(teacher);

    const refused = await markSessionAttendance(req("/x", { studentId: outsider.id, attended: true }), {
      params: { sessionId: session.id },
    });
    expect(refused.status).toBe(400);

    const accepted = await markSessionAttendance(req("/x", { studentId: member.id, attended: true }), {
      params: { sessionId: session.id },
    });
    expect(accepted.status).toBe(200);
  });
});

d("S9: upload presign", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("refuses an HTML upload whatever the purpose", async () => {
    const student = await user("uploader", "STUDENT");
    as(student);
    const res = await presign(
      req("/api/uploads/presign", {
        filename: "login.html",
        contentType: "text/html",
        fileSize: 1000,
        purpose: "posts",
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code?: string }).code).toBe("type_not_allowed");
  });

  it("a teacher can only upload materials for their own class", async () => {
    const { klass } = await classWithSession("mine", HOUR);
    const otherTeacher = await user("other-teacher", "TEACHER");
    as(otherTeacher);
    const body = { filename: "a.pdf", contentType: "application/pdf", fileSize: 1000, purpose: "material", classId: klass.id };

    expect((await presign(req("/api/uploads/presign", body))).status).toBe(403);
    expect(
      (await presign(req("/api/uploads/presign", { ...body, classId: undefined }))).status,
    ).toBe(400);
  });
});

d("S15: deleting your account", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("deactivates it and frees its seats", async () => {
    const { klass } = await classWithSession("leaver", HOUR);
    const student = await user("leaver", "STUDENT");
    await prisma.enrollment.create({ data: { studentId: student.id, classId: klass.id, status: "ACTIVE" } });
    as(student);

    const res = await deleteAccount();
    expect(res.status).toBe(200);

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: student.id },
      select: { deactivatedAt: true, email: true },
    });
    expect(row.deactivatedAt).not.toBeNull();
    const enrollment = await prisma.enrollment.findFirstOrThrow({
      where: { studentId: student.id },
      select: { status: true },
    });
    expect(enrollment.status).toBe("DROPPED");
  });

  it("strips admin powers, and refuses the last super admin", async () => {
    const admin = await user("admin-leaver", "ADMIN", {
      accessLevel: "CONTENT_MANAGER",
      permissions: permissionsForLevel("CONTENT_MANAGER"),
    });
    as(admin);
    expect((await deleteAccount()).status).toBe(200);
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: admin.id },
      select: { role: true, accessLevel: true, permissions: true },
    });
    expect(row).toEqual({ role: "STUDENT", accessLevel: null, permissions: null });

    const otherSupers = await prisma.user.count({
      where: { role: "ADMIN", accessLevel: "SUPER_ADMIN", deactivatedAt: null },
    });
    if (otherSupers === 0) {
      const onlySuper = await user("only-super", "ADMIN", { accessLevel: "SUPER_ADMIN" });
      as(onlySuper);
      const refused = await deleteAccount();
      expect(refused.status).toBe(409);
      const still = await prisma.user.findUniqueOrThrow({
        where: { id: onlySuper.id },
        select: { deactivatedAt: true },
      });
      expect(still.deactivatedAt).toBeNull();
    }
  });
});

d("S4: forgot-password", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("does not issue a second token within two minutes", async () => {
    const student = await user("forgot", "STUDENT");

    await forgotPassword(req("/api/auth/forgot-password", { email: student.email }));
    await vi.waitFor(async () => {
      expect(await prisma.passwordReset.count({ where: { userId: student.id } })).toBe(1);
    });

    await forgotPassword(req("/api/auth/forgot-password", { email: student.email }));
    // Give the background work the same chance to (wrongly) run.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await prisma.passwordReset.count({ where: { userId: student.id } })).toBe(1);
  });
});
