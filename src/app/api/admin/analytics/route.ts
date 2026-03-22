import { NextResponse } from "next/server";

import { getAdminAnalytics } from "@/lib/platform/store";
import { getSessionUser, unauthorized } from "@/lib/security/session";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ message: "Admin access only" }, { status: 403 });
  }

  const analytics = await getAdminAnalytics();
  return NextResponse.json(analytics);
}
