import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addTicketComment } from "@/lib/platform/tickets";
import { AccessError, requirePermission } from "@/lib/security/permissions";

const commentSchema = z.object({ body: z.string().trim().min(1).max(5000) });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let access;
  try {
    // Replying is the conversation this whole feature exists to hold, so it is
    // gated on view, not manage -- a reporter must be able to answer follow-ups.
    access = await requirePermission("support.view");
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = commentSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const comment = await addTicketComment(params.id, access.userId, parsed.data.body);
  if (!comment) return NextResponse.json({ message: "Not found" }, { status: 404 });

  return NextResponse.json({ comment }, { status: 201 });
}
