/**
 * Immutable audit trail for all admin actions.
 *
 * Every administrative action is logged: who did what, when, and to what.
 * Append-only — entries can never be edited or deleted via the API.
 */

import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "user.approve"
  | "user.reject"
  | "user.delete"
  | "class.create"
  | "class.edit"
  | "class.archive"
  | "material.upload"
  | "material.delete"
  | "ai.review_response"
  | "ai.clear_cache"
  | "ai.view_logs"
  | "admin.view_student_data"
  | "admin.export_data"
  | "settings.change";

export async function logAuditEvent(params: {
  actorId: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  details?: string;
  ipAddress?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        details: params.details || null,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (err) {
    // Audit logging must NEVER crash the request
    console.error("[Audit] Failed to log:", err);
  }
}
