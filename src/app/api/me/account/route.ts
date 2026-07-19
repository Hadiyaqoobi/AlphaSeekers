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
 *      approval.
 */
export async function DELETE() {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  const userId = user.id;

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
    await prisma.$transaction([
      // OAuth tokens grant calendar-write access — remove outright.
      prisma.googleAccountLink.deleteMany({ where: { userId } }),
      // Notifications can contain personal content.
      prisma.notification.deleteMany({ where: { userId } }),
      // Anonymize the user: strip PII, disable login.
      prisma.user.update({
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
        },
      }),
    ]);
  } catch (error) {
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
