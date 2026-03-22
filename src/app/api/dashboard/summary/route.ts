import { NextResponse } from "next/server";

import { getDashboardStats, getJoinNowSession, getUser, listTodaySessions } from "@/lib/platform/store";
import { getSessionUser, unauthorized } from "@/lib/security/session";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  const [profile, stats, joinNow, todaySessions] = await Promise.all([
    getUser(user.id),
    getDashboardStats(),
    user.role === "STUDENT" ? getJoinNowSession(user.id) : Promise.resolve(null),
    listTodaySessions(),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      timezone: profile?.timezone ?? "Asia/Kabul",
    },
    stats,
    joinNow,
    todaySessions: todaySessions.slice(0, 10),
  });
}
