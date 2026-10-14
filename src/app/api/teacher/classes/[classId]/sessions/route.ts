/**
 * POST /api/teacher/classes/[classId]/sessions
 *
 * Instructor-managed (MANUAL) scheduling: create a new session for a class at an
 * explicit instructor-chosen time. The acting user must own the class
 * (class.teacherId === their id) or hold the "classes.edit" permission. A
 * temp-password employee must reset their password before managing sessions.
 *
 * PATCH /api/teacher/classes/[classId]/sessions
 *
 * Set (or clear) one session's Meet link by hand: the fallback when Google is not
 * connected or link generation failed. Same authorization as POST.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { setSessionMeetLink } from "@/lib/platform/db-store";
import { createManualSession } from "@/lib/scheduling/sessions";
import { guardClassManagement } from "@/lib/security/api-guard";
import { normaliseHttpUrl } from "@/lib/security/safe-url";

export const dynamic = "force-dynamic";

type RouteContext = { params: { classId: string } };

const bodySchema = z.object({
  startTime: z.string(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
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

const meetLinkSchema = z.object({
  sessionId: z.string().trim().min(1).max(100),
  // "" or null clears the link (the scheduler's retry then tries Google again).
  meetLink: z.union([z.string().trim().max(500), z.null()]),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const guard = await guardClassManagement(params.classId);
    if (!guard.ok) return guard.response;

    const parsed = meetLinkSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }

    const raw = parsed.data.meetLink ?? "";
    // The link lands in an href on the class page, so only http(s) is accepted.
    const meetLink = raw ? normaliseHttpUrl(raw) : null;
    if (raw && !meetLink) {
      return NextResponse.json({ message: "The Meet link must start with https://" }, { status: 400 });
    }

    const updated = await setSessionMeetLink(params.classId, parsed.data.sessionId, meetLink);
    if (!updated) {
      return NextResponse.json({ message: "Session not found (or cancelled)" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, meetLink });
  } catch (error) {
    console.error("[teacher] set meet link failed", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
