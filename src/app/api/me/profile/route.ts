import { NextResponse } from "next/server";

import { getStudentProfileSummary } from "@/lib/platform/store";
import { forbidden, getSessionUser, unauthorized } from "@/lib/security/session";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "STUDENT") {
    return forbidden("Profile endpoint is available for students.");
  }

  const profile = await getStudentProfileSummary(user.id);

  if (!profile) {
    return NextResponse.json({ message: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json(profile, {
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
    },
  });
}
