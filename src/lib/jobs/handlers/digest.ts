/**
 * KPI digest job handler.
 *
 * "kpi_digest" aggregates the platform-wide KPIs and delivers a concise
 * plain-text summary to every active super admin. Delivery failures throw so the
 * queue retries; an empty super-admin set returns quietly.
 */

import { queueHealth } from "@/lib/jobs/queue";
import { collectClassIssues } from "@/lib/platform/class-health";
import { prisma } from "@/lib/prisma";
import { getSuperKpis, type SuperKpis } from "@/lib/platform/super-store";

import { deliverToMany, notifiableSelect } from "./notifications";

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Compact human age for the oldest pending job ("none" when nothing is queued). */
function formatOldestPending(ms: number | null): string {
  if (ms === null) return "none";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function formatDigest(k: SuperKpis): string {
  return [
    `AlphaSeekers KPI digest — ${k.generatedAt.slice(0, 10)}`,
    ``,
    `Students: ${k.students.total} total (+${k.students.new7d} new in 7d)`,
    `Active enrollments: ${k.students.activeEnrollments}`,
    `Upcoming sessions: ${k.classes.upcomingSessions}`,
    `Attendance rate: ${pct(k.classes.attendanceRate)}`,
    `AI interactions (7d): ${k.ai.interactions7d}`,
    `Notification delivery rate: ${pct(k.ops.deliveryRate)}`,
    `Database: ${k.ops.dbStatus}`,
  ].join("\n");
}

/** "kpi_digest" — email/notify the KPI digest to active super admins. */
export async function kpiDigest(): Promise<void> {
  const kpis = await getSuperKpis();

  // Surface job-queue backlog in the daily digest so a human is alerted to
  // dead-lettered jobs or a stalled worker without opening the super console.
  const health = await queueHealth();
  const deadCount = health.counts.DEAD ?? 0;
  const queueLine = `Job queue: ${deadCount} dead, oldest pending ${formatOldestPending(
    health.oldestPendingAgeMs,
  )}`;
  const digest = `${formatDigest(kpis)}\n${queueLine}`;

  const superAdmins = await prisma.user.findMany({
    where: { role: "ADMIN", accessLevel: "SUPER_ADMIN", deactivatedAt: null },
    select: notifiableSelect,
  });
  if (superAdmins.length === 0) return;

  const failures = await deliverToMany(superAdmins, digest, 8);
  if (failures > 0) {
    throw new Error(`kpi_digest: ${failures}/${superAdmins.length} digest deliveries failed`);
  }
}

/** Compact "how long has the oldest one been waiting" for the approvals nudge. */
function formatWaiting(since: Date): string {
  const hours = Math.round((Date.now() - since.getTime()) / 3600000);
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${hours} hours`;
  return `${Math.round(hours / 24)} days`;
}

/**
 * "class_health_digest" — the things quietly wrong with a running class.
 *
 * Separate from the approvals digest on purpose. That one answers "is there a
 * queue?"; this one answers "is anything broken?" — a class with no teacher, a
 * session hours away with no joining link, a scheduler that has stopped
 * producing. Each of those degrades a class without raising anything, and the
 * first person to notice is otherwise a student turning up to nothing.
 *
 * Sends NOTHING when every class is healthy. A daily all-clear is exactly the
 * mail people learn to filter, and it would take the real one with it.
 */
export async function classHealthDigest(): Promise<void> {
  const issues = await collectClassIssues();
  if (issues.length === 0) return;

  const base = (process.env.APP_BASE_URL ?? "https://alphaseekers.org").replace(/\/$/, "");
  const urgent = issues.filter((i) => i.severity === "urgent");

  const lines: string[] = [];
  lines.push(
    `${issues.length} ${issues.length === 1 ? "issue needs" : "issues need"} attention across your classes.`,
    ``,
  );

  let lastClass: string | null = null;
  for (const issue of issues) {
    if (issue.className !== lastClass) {
      if (lastClass !== null) lines.push(``);
      lines.push(issue.className);
      lastClass = issue.className;
    }
    lines.push(`  ${issue.severity === "urgent" ? "[urgent]" : "[warning]"} ${issue.detail}`);
    if (issue.classId) {
      lines.push(`  ${base}/en/admin/classes/${issue.classId}`);
    }
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", deactivatedAt: null },
    select: notifiableSelect,
  });
  if (admins.length === 0) return;

  const subject =
    urgent.length > 0
      ? `${urgent.length} urgent class ${urgent.length === 1 ? "issue" : "issues"} on AlphaSeekers`
      : `${issues.length} class ${issues.length === 1 ? "issue" : "issues"} to review on AlphaSeekers`;

  const failures = await deliverToMany(admins, lines.join("\n"), 8, { subject });
  if (failures > 0) {
    throw new Error(`class_health_digest: ${failures}/${admins.length} deliveries failed`);
  }
}

/**
 * "pending_approvals_digest" — tell EVERY admin how many people are waiting to
 * be approved.
 *
 * Covers BOTH gates, because the platform has two and they moved apart:
 *
 *   - platform approval (approvedAt=null) — now granted automatically at
 *     registration, so this count is normally zero and the digest must not
 *     treat zero as "nothing to report";
 *   - course approval (Enrollment.PENDING) — the gate that actually holds
 *     students back today, decided per class.
 *
 * Reporting only the first is how this digest went silent: registration was
 * opened, the platform queue emptied permanently, and the mail stopped going out
 * while students queued up somewhere it never looked.
 *
 * Goes to all admins, not just super admins like the KPI digest — approving is
 * something any of the seven can do, and spreading it means it does not wait on
 * one person.
 *
 * Sends NOTHING when the queue is empty. A daily "0 waiting" mail is noise that
 * trains people to filter the whole thread away, which would defeat the point.
 */
export async function pendingApprovalsDigest(): Promise<void> {
  const pending = await prisma.user.findMany({
    where: { approvedAt: null, deactivatedAt: null },
    select: { createdAt: true, requestedRole: true },
    orderBy: { createdAt: "asc" },
  });

  const courseRequests = await prisma.enrollment.findMany({
    where: { status: "PENDING" },
    select: { enrolledAt: true, class: { select: { id: true, name: true } } },
    orderBy: { enrolledAt: "asc" },
  });

  if (pending.length === 0 && courseRequests.length === 0) return;

  const teachers = pending.filter((p) => p.requestedRole === "TEACHER").length;
  const students = pending.length - teachers;
  const base = (process.env.APP_BASE_URL ?? "https://alphaseekers.org").replace(/\/$/, "");

  const byClass = new Map<string, { name: string; count: number }>();
  for (const r of courseRequests) {
    const entry = byClass.get(r.class.id) ?? { name: r.class.name.trim(), count: 0 };
    entry.count += 1;
    byClass.set(r.class.id, entry);
  }

  const lines: (string | null)[] = [];

  if (courseRequests.length > 0) {
    lines.push(
      `${courseRequests.length} ${courseRequests.length === 1 ? "student is" : "students are"} waiting to join a class.`,
      ``,
    );
    for (const [classId, { name, count }] of byClass) {
      lines.push(`  ${name} — ${count} waiting`);
      lines.push(`  ${base}/en/admin/classes/${classId}`);
      lines.push(``);
    }
    lines.push(`Longest wait: ${formatWaiting(courseRequests[0].enrolledAt)}`, ``);
  }

  if (pending.length > 0) {
    lines.push(
      `${pending.length} ${pending.length === 1 ? "person is" : "people are"} waiting for platform approval.`,
      ``,
      `Students: ${students}`,
      teachers > 0 ? `Applied as teacher: ${teachers}` : null,
      `Longest wait: ${formatWaiting(pending[0].createdAt)}`,
      ``,
      `Approve here: ${base}/en/admin/users`,
    );
  }

  const content = lines.filter((line) => line !== null).join("\n");

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", deactivatedAt: null },
    select: notifiableSelect,
  });
  if (admins.length === 0) return;

  const total = pending.length + courseRequests.length;
  const subject = `${total} waiting for approval on AlphaSeekers`;
  const failures = await deliverToMany(admins, content, 8, { subject });
  if (failures > 0) {
    throw new Error(
      `pending_approvals_digest: ${failures}/${admins.length} deliveries failed`,
    );
  }
}
