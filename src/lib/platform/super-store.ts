/**
 * Data access for the Super Admin console: employee provisioning + access
 * management, and platform-wide KPI aggregation.
 *
 * Employees are represented as role=ADMIN users with an `accessLevel` and an
 * explicit `permissions` array. See src/lib/security/permissions.ts.
 */

import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/passwords";
import {
  ACCESS_LEVELS,
  ALL_PERMISSIONS,
  isValidPermission,
  permissionsForLevel,
  type AccessLevel,
} from "@/lib/security/permission-catalog";

// ─── Employees ────────────────────────────────────────────────────────────────

export type EmployeeSummary = {
  id: string;
  name: string;
  email: string;
  accessLevel: AccessLevel | null;
  permissions: string[];
  deactivated: boolean;
  createdAt: Date;
  createdById: string | null;
};

function normalizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is string => typeof p === "string" && isValidPermission(p));
}

/** List staff accounts (all ADMIN-role users), newest first. */
export async function listEmployees(): Promise<EmployeeSummary[]> {
  const rows = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      name: true,
      email: true,
      accessLevel: true,
      permissions: true,
      deactivatedAt: true,
      createdAt: true,
      createdById: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    accessLevel: (ACCESS_LEVELS as readonly string[]).includes(r.accessLevel ?? "")
      ? (r.accessLevel as AccessLevel)
      : null,
    permissions: normalizePermissions(r.permissions),
    deactivated: Boolean(r.deactivatedAt),
    createdAt: r.createdAt,
    createdById: r.createdById,
  }));
}

export async function getEmployee(id: string): Promise<EmployeeSummary | null> {
  const r = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accessLevel: true,
      permissions: true,
      deactivatedAt: true,
      createdAt: true,
      createdById: true,
    },
  });
  if (!r || r.role !== "ADMIN") return null;
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    accessLevel: (ACCESS_LEVELS as readonly string[]).includes(r.accessLevel ?? "")
      ? (r.accessLevel as AccessLevel)
      : null,
    permissions: normalizePermissions(r.permissions),
    deactivated: Boolean(r.deactivatedAt),
    createdAt: r.createdAt,
    createdById: r.createdById,
  };
}

export async function countActiveSuperAdmins(): Promise<number> {
  return prisma.user.count({
    where: { role: "ADMIN", accessLevel: "SUPER_ADMIN", deactivatedAt: null },
  });
}

export type CreateEmployeeInput = {
  name: string;
  email: string;
  accessLevel: AccessLevel;
  permissions?: string[];
  createdById: string;
};

export type CreateEmployeeResult =
  | { ok: true; employee: EmployeeSummary; tempPassword: string }
  | { ok: false; error: string };

/**
 * Create an employee account. Returns a one-time temporary password the super
 * admin must hand to the employee (they are forced to change it on first login).
 */
export async function createEmployee(input: CreateEmployeeInput): Promise<CreateEmployeeResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!name) return { ok: false, error: "Name is required" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Valid email is required" };

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "A user with that email already exists" };

  const permissions =
    input.permissions && input.permissions.length > 0
      ? input.permissions.filter(isValidPermission)
      : permissionsForLevel(input.accessLevel);

  // 12-char url-safe temporary password.
  const tempPassword = crypto.randomBytes(9).toString("base64url");
  const passwordHash = await hashPassword(tempPassword);

  const created = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "ADMIN",
      accessLevel: input.accessLevel,
      permissions,
      mustChangePassword: true,
      approvedAt: new Date(),
      createdById: input.createdById,
      language: "EN",
      timezone: "Asia/Kabul",
    },
    select: {
      id: true,
      name: true,
      email: true,
      accessLevel: true,
      permissions: true,
      deactivatedAt: true,
      createdAt: true,
      createdById: true,
    },
  });

  return {
    ok: true,
    tempPassword,
    employee: {
      id: created.id,
      name: created.name,
      email: created.email,
      accessLevel: input.accessLevel,
      permissions: normalizePermissions(created.permissions),
      deactivated: false,
      createdAt: created.createdAt,
      createdById: created.createdById,
    },
  };
}

export type UpdateEmployeeAccessInput = {
  accessLevel?: AccessLevel;
  permissions?: string[];
};

export async function updateEmployeeAccess(
  id: string,
  input: UpdateEmployeeAccessInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // The last-super-admin guard and the write must be atomic: two concurrent
  // demotions could each read count=2 and both proceed, locking everyone out.
  // We run the check + write in one interactive transaction and take a row lock
  // (SELECT … FOR UPDATE) on the active super-admin rows so a concurrent
  // demotion/deactivation blocks until we commit.
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id },
      select: { role: true, accessLevel: true, deactivatedAt: true },
    });
    if (!target || target.role !== "ADMIN") return { ok: false, error: "Employee not found" };

    // Guard against locking everyone out: never demote the last active super admin.
    if (
      target.accessLevel === "SUPER_ADMIN" &&
      input.accessLevel &&
      input.accessLevel !== "SUPER_ADMIN"
    ) {
      const lockedSupers = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User"
        WHERE "role" = 'ADMIN' AND "accessLevel" = 'SUPER_ADMIN' AND "deactivatedAt" IS NULL
        FOR UPDATE
      `;
      if (lockedSupers.length <= 1) return { ok: false, error: "Cannot demote the last super admin" };
    }

    await tx.user.update({
      where: { id },
      data: {
        ...(input.accessLevel ? { accessLevel: input.accessLevel } : {}),
        ...(input.permissions ? { permissions: input.permissions.filter(isValidPermission) } : {}),
      },
    });
    return { ok: true };
  });
}

export async function setEmployeeDeactivated(
  id: string,
  deactivated: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Same atomicity requirement as updateEmployeeAccess: run the last-super-admin
  // guard and the write in one interactive transaction, taking a row lock on the
  // active super-admin rows so concurrent demotions/deactivations serialize.
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id },
      select: { role: true, accessLevel: true },
    });
    if (!target || target.role !== "ADMIN") return { ok: false, error: "Employee not found" };

    if (deactivated && target.accessLevel === "SUPER_ADMIN") {
      const lockedSupers = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User"
        WHERE "role" = 'ADMIN' AND "accessLevel" = 'SUPER_ADMIN' AND "deactivatedAt" IS NULL
        FOR UPDATE
      `;
      if (lockedSupers.length <= 1) return { ok: false, error: "Cannot deactivate the last super admin" };
    }

    await tx.user.update({
      where: { id },
      data: { deactivatedAt: deactivated ? new Date() : null },
    });
    return { ok: true };
  });
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export type TimePoint = { day: string; count: number };

export type SuperKpis = {
  generatedAt: string;
  students: {
    total: number;
    pendingApproval: number;
    new7d: number;
    new30d: number;
    activeEnrollments: number;
    enrollments7d: number;
    signupTrend: TimePoint[];
  };
  classes: {
    total: number;
    active: number;
    totalSessions: number;
    upcomingSessions: number;
    teachers: number;
    attendanceRate: number; // 0..1
    capacityFill: number; // 0..1 (active enrollments / total capacity of active classes)
  };
  ai: {
    totalInteractions: number;
    interactions7d: number;
    cacheHitRate: number; // 0..1
    avgResponseMs: number | null;
    byProvider: { provider: string; count: number }[];
    trend: TimePoint[];
  };
  ops: {
    notifications: { status: string; count: number }[];
    deliveryRate: number; // 0..1 (SENT / total attempted)
    postsPendingReview: number;
    auditEvents24h: number;
    dbStatus: "ok" | "degraded";
  };
};

function bucketDays(rows: { day: Date | string; count: number | bigint }[], days: number): TimePoint[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = typeof r.day === "string" ? r.day.slice(0, 10) : r.day.toISOString().slice(0, 10);
    map.set(d, Number(r.count));
  }
  const out: TimePoint[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    out.push({ day: d, count: map.get(d) ?? 0 });
  }
  return out;
}

export async function getSuperKpis(): Promise<SuperKpis> {
  const now = Date.now();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const since14d = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const nowDate = new Date(now);

  const [
    totalStudents,
    pendingApproval,
    newStudents7d,
    newStudents30d,
    activeEnrollments,
    enrollments7d,
    totalClasses,
    activeClasses,
    totalSessions,
    upcomingSessions,
    teachers,
    attendanceTotal,
    attendanceAttended,
    activeCapacityAgg,
    activeEnrollmentsInActiveClasses,
    aiTotal,
    aiRecent,
    aiByProvider,
    aiResponse,
    notifGroups,
    postsPendingReview,
    signupRows,
    aiTrendRows,
    dbPing,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "STUDENT", approvedAt: null } }),
    prisma.user.count({ where: { role: "STUDENT", createdAt: { gte: since7d } } }),
    prisma.user.count({ where: { role: "STUDENT", createdAt: { gte: since30d } } }),
    prisma.enrollment.count({ where: { status: "ACTIVE" } }),
    prisma.enrollment.count({ where: { status: "ACTIVE", enrolledAt: { gte: since7d } } }),
    prisma.class.count(),
    prisma.class.count({ where: { status: "ACTIVE" } }),
    prisma.session.count(),
    prisma.session.count({ where: { cancelled: false, startTime: { gte: nowDate } } }),
    prisma.user.count({ where: { role: "TEACHER" } }),
    prisma.attendance.count(),
    prisma.attendance.count({ where: { attended: true } }),
    prisma.class.aggregate({ where: { status: "ACTIVE" }, _sum: { maxStudents: true } }),
    prisma.enrollment.count({ where: { status: "ACTIVE", class: { status: "ACTIVE" } } }),
    prisma.aIInteraction.count(),
    prisma.aIInteraction.count({ where: { createdAt: { gte: since7d } } }),
    prisma.aIInteraction.groupBy({ by: ["provider"], _count: { _all: true } }),
    prisma.aIInteraction.aggregate({ _avg: { responseMs: true } }),
    prisma.notification.groupBy({ by: ["channel", "status"], _count: { _all: true } }),
    prisma.studentPost.count({ where: { status: "pending_review" } }),
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS day, count(*) AS count
      FROM "User"
      WHERE "role" = 'STUDENT' AND "createdAt" >= ${since14d}
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS day, count(*) AS count
      FROM "AIInteraction"
      WHERE "createdAt" >= ${since14d}
      GROUP BY 1 ORDER BY 1
    `,
    prisma
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false),
  ]);

  const capacity = activeCapacityAgg._sum.maxStudents ?? 0;

  const cacheHits = aiByProvider
    .filter((p) => (p.provider ?? "").toLowerCase() === "cache")
    .reduce((s, p) => s + p._count._all, 0);

  // Delivery health is scoped to CONFIGURED channels — those that have delivered at
  // least one notification (>=1 SENT). Opt-in channels that were never set up (Web Push
  // without VAPID keys, Telegram without a bot token) only ever produce FAILED rows;
  // counting those as delivery failures would permanently mark an otherwise-healthy
  // platform "degraded". Email (the always-on channel) therefore drives this metric.
  const activeChannels = new Set(
    notifGroups.filter((g) => g.status === "SENT" && g._count._all > 0).map((g) => g.channel),
  );
  const notifByStatus = new Map<string, number>();
  for (const g of notifGroups) {
    if (!activeChannels.has(g.channel)) continue;
    notifByStatus.set(g.status, (notifByStatus.get(g.status) ?? 0) + g._count._all);
  }
  const notifTotal = [...notifByStatus.values()].reduce((s, n) => s + n, 0);
  const notifSent = notifByStatus.get("SENT") ?? 0;

  return {
    generatedAt: new Date(now).toISOString(),
    students: {
      total: totalStudents,
      pendingApproval,
      new7d: newStudents7d,
      new30d: newStudents30d,
      activeEnrollments,
      enrollments7d,
      signupTrend: bucketDays(signupRows, 14),
    },
    classes: {
      total: totalClasses,
      active: activeClasses,
      totalSessions,
      upcomingSessions,
      teachers,
      attendanceRate: attendanceTotal > 0 ? attendanceAttended / attendanceTotal : 0,
      // capacityFill = active enrollments in ACTIVE classes ÷ summed seats of those
      // same ACTIVE classes (same scope on both sides), clamped to [0,1].
      capacityFill:
        capacity > 0 ? Math.min(Math.max(activeEnrollmentsInActiveClasses / capacity, 0), 1) : 0,
    },
    ai: {
      totalInteractions: aiTotal,
      interactions7d: aiRecent,
      cacheHitRate: aiTotal > 0 ? cacheHits / aiTotal : 0,
      avgResponseMs: aiResponse._avg.responseMs ?? null,
      byProvider: aiByProvider
        .map((p) => ({ provider: p.provider ?? "unknown", count: p._count._all }))
        .sort((a, b) => b.count - a.count),
      trend: bucketDays(aiTrendRows, 14),
    },
    ops: {
      notifications: [...notifByStatus.entries()].map(([status, count]) => ({ status, count })),
      deliveryRate: notifTotal > 0 ? notifSent / notifTotal : 0,
      postsPendingReview,
      auditEvents24h: 0, // filled by the page via countRecentAudit to keep this query set lean
      dbStatus: dbPing ? "ok" : "degraded",
    },
  };
}

export { ALL_PERMISSIONS };
