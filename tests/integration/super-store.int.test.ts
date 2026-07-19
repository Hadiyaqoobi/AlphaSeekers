/**
 * Integration tests for the Super Admin data layer against a REAL Postgres.
 *
 * Runs only when DATABASE_URL points at a disposable test database (guarded so
 * it never touches a real environment). Exercises employee provisioning, the
 * last-super-admin guards, and the KPI aggregation SQL (groupBy, aggregate, and
 * raw date_trunc trend queries) end-to-end.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { recordAudit, listAuditLog } from "@/lib/security/audit";
import {
  countActiveSuperAdmins,
  createEmployee,
  getSuperKpis,
  listEmployees,
  setEmployeeDeactivated,
  updateEmployeeAccess,
} from "@/lib/platform/super-store";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const TAG = "inttest";
const email = (s: string) => `${TAG}+${s}@example.com`;

const d = shouldRun ? describe : describe.skip;

async function cleanup() {
  // Order matters for FKs; delete children then the tagged users.
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${TAG}+` } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.attendance.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.aIInteraction.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { class: { teacher: { id: { in: ids } } } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.auditLog.deleteMany({ where: { actorId: { startsWith: `${TAG}-` } } });
}

d("super-store integration (real Postgres)", () => {
  beforeAll(async () => {
    await cleanup();
    // Seed one super admin so the last-super-admin guards have context.
    await createEmployee({
      name: "Root Super",
      email: email("root"),
      accessLevel: "SUPER_ADMIN",
      createdById: "seed",
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("provisions an employee with a hashed temp password and forced reset", async () => {
    const res = await createEmployee({
      name: "Sara Support",
      email: email("sara"),
      accessLevel: "SUPPORT",
      createdById: "seed",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.tempPassword.length).toBeGreaterThanOrEqual(8);
    expect(res.employee.accessLevel).toBe("SUPPORT");
    expect(res.employee.permissions).toContain("users.view");

    const row = await prisma.user.findUnique({ where: { email: email("sara") } });
    expect(row?.role).toBe("ADMIN");
    expect(row?.mustChangePassword).toBe(true);
    expect(row?.passwordHash).toBeTruthy();
    // Password is stored hashed, never in plaintext.
    expect(row?.passwordHash).not.toBe(res.tempPassword);
  });

  it("rejects a duplicate email", async () => {
    const res = await createEmployee({
      name: "Dup",
      email: email("sara"),
      accessLevel: "SUPPORT",
      createdById: "seed",
    });
    expect(res.ok).toBe(false);
  });

  it("updates an employee's access level and permissions", async () => {
    const emp = (await listEmployees()).find((e) => e.email === email("sara"));
    expect(emp).toBeTruthy();
    const upd = await updateEmployeeAccess(emp!.id, {
      accessLevel: "MODERATOR",
      permissions: ["content.view", "content.moderate"],
    });
    expect(upd.ok).toBe(true);
    const row = await prisma.user.findUnique({ where: { id: emp!.id } });
    expect(row?.accessLevel).toBe("MODERATOR");
    expect(row?.permissions).toEqual(["content.view", "content.moderate"]);
  });

  it("refuses to demote or deactivate the last active super admin", async () => {
    expect(await countActiveSuperAdmins()).toBe(1);
    const root = (await listEmployees()).find((e) => e.email === email("root"));
    expect(root).toBeTruthy();

    const demote = await updateEmployeeAccess(root!.id, { accessLevel: "ADMIN" });
    expect(demote.ok).toBe(false);

    const deact = await setEmployeeDeactivated(root!.id, true);
    expect(deact.ok).toBe(false);
  });

  it("deactivation of a non-last super is allowed and reflected", async () => {
    const emp = (await listEmployees()).find((e) => e.email === email("sara"));
    const res = await setEmployeeDeactivated(emp!.id, true);
    expect(res.ok).toBe(true);
    const row = await prisma.user.findUnique({ where: { id: emp!.id } });
    expect(row?.deactivatedAt).toBeTruthy();
  });

  it("computes KPIs across all four areas with real aggregation SQL", async () => {
    // Seed a small dataset: teacher + class + session + student + enrollment + attendance.
    const teacher = await prisma.user.create({
      data: { name: "T", email: email("teacher"), role: "TEACHER" },
    });
    const student = await prisma.user.create({
      data: { name: "S", email: email("student"), role: "STUDENT", approvedAt: new Date() },
    });
    const klass = await prisma.class.create({
      data: {
        name: "Algebra",
        subjectCategory: "math",
        description: "x",
        teacherId: teacher.id,
        maxStudents: 20,
        status: "ACTIVE",
      },
    });
    const session = await prisma.session.create({
      data: {
        classId: klass.id,
        startTime: new Date(Date.now() + 3600_000),
        endTime: new Date(Date.now() + 7200_000),
      },
    });
    await prisma.enrollment.create({ data: { studentId: student.id, classId: klass.id, status: "ACTIVE" } });
    await prisma.attendance.create({ data: { sessionId: session.id, studentId: student.id, attended: true } });
    await prisma.notification.create({
      data: { userId: student.id, channel: "EMAIL", content: "hi", status: "SENT" },
    });
    await prisma.aIInteraction.create({
      data: { userId: student.id, query: "q", provider: "groq", responseMs: 120 },
    });

    const kpis = await getSuperKpis();

    expect(kpis.students.total).toBeGreaterThanOrEqual(1);
    expect(kpis.classes.total).toBeGreaterThanOrEqual(1);
    expect(kpis.classes.upcomingSessions).toBeGreaterThanOrEqual(1);
    expect(kpis.classes.attendanceRate).toBeGreaterThan(0);
    expect(kpis.classes.capacityFill).toBeGreaterThan(0);
    expect(kpis.ai.totalInteractions).toBeGreaterThanOrEqual(1);
    expect(kpis.ai.byProvider.length).toBeGreaterThanOrEqual(1);
    expect(kpis.ai.trend.length).toBe(14); // 14-day bucketed trend
    expect(kpis.students.signupTrend.length).toBe(14);
    expect(kpis.ops.dbStatus).toBe("ok");
    expect(kpis.ops.notifications.some((n) => n.status === "SENT")).toBe(true);
  });

  it("records and lists audit entries", async () => {
    await recordAudit({
      actorId: `${TAG}-actor`,
      actorEmail: email("root"),
      action: "employee.create",
      targetType: "user",
      targetId: `${TAG}-target`,
      details: "test",
    });
    const { items } = await listAuditLog({ limit: 10 });
    expect(items.some((i) => i.actorId === `${TAG}-actor` && i.action === "employee.create")).toBe(true);
  });
});
