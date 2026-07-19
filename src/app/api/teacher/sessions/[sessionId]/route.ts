/**
 * PATCH /api/teacher/sessions/[sessionId]
 *
 * Instructor-managed (MANUAL) scheduling: move an existing session to a new
 * instructor-chosen time (regenerates the Meet link and re-notifies students).
 * The acting user must own the session's class (class.teacherId === their id) or
 * hold the "classes.edit" permission. A temp-password employee must reset their
 * password before managing sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { rescheduleSession } from "@/lib/scheduling/sessions";
import { guardSessionManagement } from "@/lib/security/api-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: { sessionId: string } };

const bodySchema = z.object({
  startTime: z.string(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const guard = await guardSessionManagement(params.sessionId);
    if (!guard.ok) return guard.response;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }

    const startTime = new Date(parsed.data.startTime);
    if (Number.isNaN(startTime.getTime())) {
      return NextResponse.json({ message: "Invalid startTime" }, { status: 400 });
    }

    const result = await rescheduleSession({
      sessionId: guard.session.id,
      startTime,
      durationMinutes: parsed.data.durationMinutes,
    });
    if (!result.ok) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[teacher] rescheduleSession failed", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
