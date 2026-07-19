/**
 * POST /api/teacher/sessions/[sessionId]/confirm
 *
 * Instructor-managed (MANUAL) scheduling: accept an auto-proposed session's time
 * as-is, marking it instructor-confirmed. The acting user must own the session's
 * class (class.teacherId === their id) or hold the "classes.edit" permission. A
 * temp-password employee must reset their password before managing sessions.
 */

import { NextRequest, NextResponse } from "next/server";

import { confirmSession } from "@/lib/scheduling/sessions";
import { guardSessionManagement } from "@/lib/security/api-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: { sessionId: string } };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const guard = await guardSessionManagement(params.sessionId);
    if (!guard.ok) return guard.response;

    const result = await confirmSession(guard.session.id);
    if (!result.ok) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[teacher] confirmSession failed", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
