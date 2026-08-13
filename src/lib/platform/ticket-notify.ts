import { prisma } from "@/lib/prisma";
import { sendUrgentTicketEmail } from "@/lib/integrations/notifications";

/**
 * Who gets paged for an urgent ticket: the super admins, because they are the
 * ones who can actually act on it. Resolved from the database rather than
 * hardcoded so adding a super admin does not silently miss alerts.
 */
async function urgentRecipients(): Promise<string[]> {
  const supers = await prisma.user.findMany({
    where: { role: "ADMIN", accessLevel: "SUPER_ADMIN", email: { not: "" } },
    select: { email: true },
  });
  return supers.map((s) => s.email).filter((e): e is string => Boolean(e));
}

/**
 * Fire-and-forget: a failed alert must never fail the ticket submission. The
 * ticket row is the durable record; the email is a convenience on top of it.
 */
export async function notifyUrgentTicket(ticket: {
  id: string;
  title: string;
  description: string;
  type: string;
  area?: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
}): Promise<void> {
  try {
    const to = await urgentRecipients();
    const base = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? "https://alphaseekers.org";
    await sendUrgentTicketEmail(to, {
      ...ticket,
      url: `${base.replace(/\/$/, "")}/en/admin/support/${ticket.id}`,
    });
  } catch (error) {
    console.error("[tickets] urgent alert failed to send", ticket.id, error);
  }
}
