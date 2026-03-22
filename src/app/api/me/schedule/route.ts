import { NextResponse } from "next/server";

import { getJoinNowSession, listStudentSchedule } from "@/lib/platform/store";
import { getSessionUser, unauthorized } from "@/lib/security/session";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  const [schedule, joinNow] = await Promise.all([listStudentSchedule(user.id), getJoinNowSession(user.id)]);

  return NextResponse.json(
    {
      joinNow,
      items: schedule,
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    },
  );
}
