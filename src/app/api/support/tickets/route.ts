import { NextRequest, NextResponse } from "next/server";
import { TicketPriority, TicketStatus, TicketType } from "@prisma/client";
import { z } from "zod";

import { createTicket, listTickets } from "@/lib/platform/tickets";
import { notifyUrgentTicket } from "@/lib/platform/ticket-notify";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { recordAudit } from "@/lib/security/audit";

const createSchema = z.object({
  title: z.string().trim().min(4).max(160),
  description: z.string().trim().min(10).max(5000),
  type: z.nativeEnum(TicketType),
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.NORMAL),
  area: z.string().trim().max(120).optional(),
  attachmentUrl: z.string().trim().url().max(500).optional(),
});

function accessErrorResponse(e: unknown) {
  if (e instanceof AccessError) {
    return NextResponse.json({ message: e.message }, { status: e.status });
  }
  return null;
}

export async function GET(request: NextRequest) {
  let access;
  try {
    access = await requirePermission("support.view");
  } catch (e) {
    const res = accessErrorResponse(e);
    if (res) return res;
    throw e;
  }
  void access;

  const params = request.nextUrl.searchParams;
  const rawStatus = params.get("status") ?? "ALL";
  const rawType = params.get("type") ?? "ALL";

  const status =
    rawStatus === "ALL" || rawStatus in TicketStatus ? (rawStatus as TicketStatus | "ALL") : "ALL";
  const type = rawType === "ALL" || rawType in TicketType ? (rawType as TicketType | "ALL") : "ALL";

  return NextResponse.json({ tickets: await listTickets({ status, type }) });
}

export async function POST(request: NextRequest) {
  let access;
  try {
    access = await requirePermission("support.create");
  } catch (e) {
    const res = accessErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ticket = await createTicket({ ...parsed.data, reporterId: access.userId });

  await recordAudit({
    actorId: access.userId,
    actorEmail: access.email,
    action: "ticket.create",
    targetType: "Ticket",
    targetId: ticket.id,
    details: `${ticket.type} / ${ticket.priority}: ${ticket.title}`,
  });

  // Urgent tickets page the maintainer; normal ones wait for the review sweep,
  // which is the whole point of not turning this back into an inbox. A failed
  // send must never fail the ticket -- the record is what matters.
  if (ticket.priority === TicketPriority.URGENT) {
    void notifyUrgentTicket({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      type: ticket.type,
      area: ticket.area,
      reporterName: ticket.reporter.name,
      reporterEmail: ticket.reporter.email,
    });
  }

  return NextResponse.json({ ticket: { id: ticket.id } }, { status: 201 });
}
