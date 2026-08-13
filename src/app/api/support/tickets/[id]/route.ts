import { NextRequest, NextResponse } from "next/server";
import { TicketStatus } from "@prisma/client";
import { z } from "zod";

import { getTicketById, setTicketStatus } from "@/lib/platform/tickets";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { recordAudit } from "@/lib/security/audit";

const patchSchema = z.object({ status: z.nativeEnum(TicketStatus) });

function accessErrorResponse(e: unknown) {
  if (e instanceof AccessError) {
    return NextResponse.json({ message: e.message }, { status: e.status });
  }
  return null;
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission("support.view");
  } catch (e) {
    const res = accessErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const ticket = await getTicketById(params.id);
  if (!ticket) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  let access;
  try {
    // Filing a ticket is open to every admin; deciding it is done is not.
    access = await requirePermission("support.manage");
  } catch (e) {
    const res = accessErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await setTicketStatus(params.id, parsed.data.status);
  if (!updated) return NextResponse.json({ message: "Not found" }, { status: 404 });

  await recordAudit({
    actorId: access.userId,
    actorEmail: access.email,
    action: "ticket.status",
    targetType: "Ticket",
    targetId: params.id,
    details: `status -> ${parsed.data.status}`,
  });

  return NextResponse.json({ ticket: updated });
}
