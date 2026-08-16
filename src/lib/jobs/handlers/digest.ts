/**
 * KPI digest job handler.
 *
 * "kpi_digest" aggregates the platform-wide KPIs and delivers a concise
 * plain-text summary to every active super admin. Delivery failures throw so the
 * queue retries; an empty super-admin set returns quietly.
 */

import { queueHealth } from "@/lib/jobs/queue";
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
 * "pending_approvals_digest" — tell EVERY admin how many people are waiting to
 * be approved.
 *
 * A new signup lands with approvedAt=null and cannot enrol in anything until an
 * admin approves them, and nothing used to say so: the queue was only visible to
 * whoever happened to open the Users page. During an enrolment campaign that is
 * a student sitting locked out for days.
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

  if (pending.length === 0) return;

  const teachers = pending.filter((p) => p.requestedRole === "TEACHER").length;
  const students = pending.length - teachers;
  const base = (process.env.APP_BASE_URL ?? "https://alphaseekers.org").replace(/\/$/, "");

  const content = [
    `${pending.length} ${pending.length === 1 ? "person is" : "people are"} waiting for approval on AlphaSeekers.`,
    ``,
    `Students: ${students}`,
    teachers > 0 ? `Applied as teacher: ${teachers}` : null,
    `Longest wait: ${formatWaiting(pending[0].createdAt)}`,
    ``,
    `Until someone approves them they cannot join a class.`,
    ``,
    `Approve here: ${base}/en/admin/users`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", deactivatedAt: null },
    select: notifiableSelect,
  });
  if (admins.length === 0) return;

  const subject = `${pending.length} waiting for approval on AlphaSeekers`;
  const failures = await deliverToMany(admins, content, 8, { subject });
  if (failures > 0) {
    throw new Error(
      `pending_approvals_digest: ${failures}/${admins.length} deliveries failed`,
    );
  }
}
