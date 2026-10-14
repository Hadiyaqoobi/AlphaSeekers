import { EnrollmentStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { deleteAllUserData } from "@/lib/ai/privacy/data-retention";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/security/session";

/**
 * DELETE /api/me/account
 *
 * Account deletion / right-to-erasure for the authenticated user.
 *
 * Strategy: ERASE PII + ANONYMIZE rather than hard-delete the User row.
 * A hard delete would either violate foreign keys that RESTRICT (a teacher's
 * classes, uploaded materials) or silently cascade-destroy authored content
 * and rosters. Anonymizing removes every piece of PII and disables login
 * while keeping referential integrity intact — the safe default.
 *
 * Steps:
 *   1. deleteAllUserData(userId) — best-effort removal/anonymization of the
 *      user's AI data (document chunks, cached answers, conversations/tutor
 *      rows). Owned by the AI privacy module.
 *   2. Delete sensitive linked rows (Google OAuth tokens, notifications).
 *   3. Anonymize the User record: strip name/email/phone, clear passwordHash
 *      (disables credential login), telegram/push/notification prefs, and
 *      approval — and DEACTIVATE it. Without deactivatedAt the signed-in
 *      session kept working, an admin kept admin, the pending-approvals digest
 *      counted the ghost forever, and its enrolments kept seats and bounced
 *      reminders. So: deactivate, release seats (DROPPED), delete webinar
 *      registrations and reset tokens, and strip every staff grant.
 *
 * The last active super admin cannot delete themselves: nobody would be left
 * who can manage employees (same rule as super-store's demote/deactivate).
 */

/** Active super admins, row-locked, as super-store's guard counts them. */
async function lockedActiveSuperIds(tx: Prisma.TransactionClient): Promise<string[]> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "User"
    WHERE "role" = 'ADMIN' AND "accessLevel" = 'SUPER_ADMIN' AND "deactivatedAt" IS NULL
    FOR UPDATE
  `;
  return rows.map((row) => row.id);
}

class LastSuperAdminError extends Error {}

function lastSuperAdmin() {
  return NextResponse.json(
    {
      message: "You are the only super admin. Make someone else a super admin before deleting this account.",
      code: "LAST_SUPER_ADMIN",
    },
    { status: 409 },
  );
}
export async function DELETE() {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  const userId = user.id;

  // Checked before anything is erased (and again, locked, in the transaction
  // below) so a refused deletion leaves the account untouched.
  const self = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, accessLevel: true },
  });
  if (self?.role === "ADMIN" && self.accessLevel === "SUPER_ADMIN") {
    const supers = await prisma.user.count({
      where: { role: "ADMIN", accessLevel: "SUPER_ADMIN", deactivatedAt: null },
    });
    if (supers <= 1) return lastSuperAdmin();
  }

  // 1) Best-effort deletion/anonymization of AI-derived data.
  try {
    await deleteAllUserData(userId);
  } catch (error) {
    console.error("[me/account] deleteAllUserData failed:", error);
    return NextResponse.json(
      { message: "Account deletion failed. Please try again or contact support." },
      { status: 500 },
    );
  }

  // 2) + 3) Remove sensitive linked records and anonymize the core row.
  const anonymizedEmail = `deleted+${userId}@deleted.alphaseekers.invalid`;

  try {
    await prisma.$transaction(async (tx) => {
      if (self?.role === "ADMIN" && self.accessLevel === "SUPER_ADMIN") {
        const supers = await lockedActiveSuperIds(tx);
        if (supers.length <= 1) throw new LastSuperAdminError();
      }

      // OAuth tokens grant calendar-write access — remove outright.
      await tx.googleAccountLink.deleteMany({ where: { userId } });
      // Notifications can contain personal content.
      await tx.notification.deleteMany({ where: { userId } });
      // Nothing should be sent to, or reserved for, an account that is gone.
      await tx.webinarRegistration.deleteMany({ where: { userId } });
      await tx.passwordReset.deleteMany({ where: { userId } });
      // Free the seats. DROPPED (not deleted) keeps attendance history intact.
      await tx.enrollment.updateMany({
        where: {
          studentId: userId,
          status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING] },
        },
        data: { status: EnrollmentStatus.DROPPED },
      });
      // Sign-up answers (phone, age, reason...) are personal data: gone with
      // the account, on every enrolment whatever its status (ADR-0009).
      await tx.enrollment.updateMany({
        where: { studentId: userId, answers: { not: Prisma.DbNull } },
        data: { answers: Prisma.DbNull },
      });
      // Anonymize the user: strip PII, disable login, revoke the session.
      await tx.user.update({
        where: { id: userId },
        data: {
          name: "Deleted User",
          email: anonymizedEmail,
          phone: null,
          passwordHash: null,
          telegramChatId: null,
          pushSubscription: null,
          notificationPrefs: null,
          approvedAt: null,
          // The JWT re-check revokes a deactivated account's session.
          deactivatedAt: new Date(),
          // Strip staff grants. An ADMIN with NO accessLevel and NO permissions
          // reads as an unrestricted legacy admin (permissions.ts), so clearing
          // them alone would do the opposite of what is meant — the role goes
          // too. A teacher stays TEACHER so their classes still have an owner
          // an admin can reassign.
          accessLevel: null,
          permissions: Prisma.DbNull,
          ...(self?.role === "ADMIN" ? { role: "STUDENT" as const } : {}),
        },
      });
    });
  } catch (error) {
    if (error instanceof LastSuperAdminError) return lastSuperAdmin();
    console.error("[me/account] account anonymization failed:", error);
    return NextResponse.json(
      { message: "Account deletion failed. Please try again or contact support." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Your account and personal data have been deleted.",
  });
}
