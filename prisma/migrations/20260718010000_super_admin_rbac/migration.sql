-- Super Admin RBAC migration.
--
-- 1. Creates the "AuditLog" table. NOTE: the AuditLog *model* was added to
--    schema.prisma by the production-hardening change, but its CREATE TABLE was
--    omitted from 20260718000000_production_hardening/migration.sql — so the
--    generated Prisma client knew about prisma.auditLog while the physical table
--    did not exist. This migration closes that drift.
-- 2. Adds the employee/RBAC columns to "User" (accessLevel, permissions,
--    deactivatedAt, mustChangePassword, createdById) plus a covering index.
--
-- Additive only; IF NOT EXISTS makes re-application safe.

-- ─── AuditLog table (closes prior schema/migration drift) ────────────────────

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- If the table already existed (e.g. a hotfix created it without actorEmail),
-- make sure the column is present.
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "actorEmail" TEXT;

CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- ─── User RBAC / employee columns ────────────────────────────────────────────

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accessLevel" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

CREATE INDEX IF NOT EXISTS "User_accessLevel_idx" ON "User"("accessLevel");
