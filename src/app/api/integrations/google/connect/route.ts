import { NextRequest, NextResponse } from "next/server";

import { createGoogleAuthUrl } from "@/lib/integrations/google-auth";
import { getSessionUser, unauthorized } from "@/lib/security/session";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    return NextResponse.json({ message: "Only teachers/admins can connect Google" }, { status: 403 });
  }

  try {
    // Only a known locale goes into the OAuth state: the callback builds its
    // redirect from it, and "/evil.com" there became a redirect off-site.
    const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "fa";
    const url = createGoogleAuthUrl(user.id, locale);
    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to start Google OAuth",
      },
      { status: 500 },
    );
  }
}
