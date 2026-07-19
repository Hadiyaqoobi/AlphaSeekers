/**
 * Audit trail for privileged staff actions (employee provisioning, access
 * changes, deactivations, etc.). Writes are best-effort: a failure to record an
 * audit entry must never break the underlying action, but it is logged.
 */

import { prisma } from "@/lib/prisma";

export type AuditEntryInput = {
  actorId: string;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  details?: string | null;
  ipAddress?: string | null;
};

export async function recordAudit(entry: AuditEntryInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        actorEmail: entry.actorEmail ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        details: entry.details ?? null,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record entry", entry.action, error);
  }
}

export type AuditLogRow = {
  id: string;
  actorId: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: Date;
};

export async function listAuditLog(opts: { limit?: number; cursor?: string } = {}): Promise<{
  items: AuditLogRow[];
  nextCursor: string | null;
}> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  // createdAt is not unique, so it alone is an unstable sort for id-cursored
  // pagination (rows can be skipped or duplicated across pages). Break ties on the
  // unique id to make the order a stable total order that matches the cursor.
  const rows = await prisma.auditLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]!.id : null,
  };
}

export async function countRecentAudit(sinceMs: number): Promise<number> {
  const since = new Date(Date.now() - sinceMs);
  return prisma.auditLog.count({ where: { createdAt: { gte: since } } });
}
