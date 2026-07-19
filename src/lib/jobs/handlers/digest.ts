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
