import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/queue";
import { recordAudit } from "@/lib/security/audit";
import { AccessError, requireSuperAdmin } from "@/lib/security/permissions";

/**
 * Send a one-off message to named platform users through the platform's own
 * SMTP, so team announcements come from the organisation address rather than
 * somebody's personal mailbox.
 *
 * Recipients are given as user IDs, never raw addresses: the address is looked
 * up from the account. That keeps this from becoming an open relay — it can
 * only ever mail people who already have an AlphaSeekers account.
 *
 * Super admin only. Delivery runs through the durable queue, so a slow or
 * failing SMTP never blocks the request, and each send is retried on its own.
 */
const schema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(20).max(20000),
  userIds: z.array(z.string().trim().min(1)).min(1).max(50),
  /** Distinguishes reruns; without it a repeat send is silently deduped away. */
  dedupeTag: z.string().trim().min(1).max(80),
});

export async function POST(request: NextRequest) {
  let access;
  try {
    access = await requireSuperAdmin();
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { subject, body, userIds, dedupeTag } = parsed.data;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, email: { not: "" } },
    select: { id: true, name: true, email: true },
  });

  if (users.length === 0) {
    return NextResponse.json({ message: "No matching users with an email address" }, { status: 404 });
  }

  const queued: string[] = [];
  for (const user of users) {
    await enqueue(
      "send_notification",
      {
        userId: user.id,
        email: user.email,
        // Nulled so the fallback chain cannot divert an announcement to a
        // Telegram chat or a push notification nobody reads.
        phone: null,
        telegramChatId: null,
        pushSubscription: null,
        subject,
        content: body,
      },
      { dedupeKey: `announcement:${dedupeTag}:${user.id}` },
    );
    queued.push(user.email);
  }

  await recordAudit({
    actorId: access.userId,
    actorEmail: access.email,
    action: "announcement.send",
    targetType: "User",
    targetId: users.map((u) => u.id).join(","),
    details: `"${subject}" queued for ${queued.length} recipient(s)`,
  });

  return NextResponse.json({ queued: queued.length, recipients: queued }, { status: 202 });
}
