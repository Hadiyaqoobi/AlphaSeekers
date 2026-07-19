/**
 * POST /api/teacher/classes/[classId]/sessions
 *
 * Instructor-managed (MANUAL) scheduling: create a new session for a class at an
 * explicit instructor-chosen time. The acting user must own the class
 * (class.teacherId === their id) or hold the "classes.edit" permission. A
 * temp-password employee must reset their password before managing sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createManualSession } from "@/lib/scheduling/sessions";
import { guardClassManagement } from "@/lib/security/api-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: { classId: string } };

const bodySchema = z.object({
  startTime: z.string(),
  durationMinutes: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const guard = await guardClassManagement(params.classId);
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

    const result = await createManualSession({
      classId: params.classId,
      startTime,
      durationMinutes: parsed.data.durationMinutes,
    });
    if (!result.ok) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json({ sessionId: result.sessionId }, { status: 201 });
  } catch (error) {
    console.error("[teacher] createManualSession failed", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
