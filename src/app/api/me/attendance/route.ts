import { NextResponse } from "next/server";

import { getStudentAttendanceHistory } from "@/lib/platform/store";
import { getSessionUser, unauthorized } from "@/lib/security/session";

/**
 * GET /api/me/attendance
 * Returns attendance history for the current student across all enrolled classes.
 */
export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  const data = await getStudentAttendanceHistory(user.id);
  return NextResponse.json(data);
}
