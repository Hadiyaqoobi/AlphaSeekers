-- Additive: when the user last changed or reset their password. Session tokens
-- issued before this moment are revoked at their next re-check (src/lib/auth.ts).
-- Null for every existing row, so no current session is affected by deploying it.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);
