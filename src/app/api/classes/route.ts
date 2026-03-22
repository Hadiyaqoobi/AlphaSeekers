import { NextRequest, NextResponse } from "next/server";

import { listClasses, parseInteger } from "@/lib/platform/store";
import { getSessionUser, isApproved, pendingApproval, unauthorized } from "@/lib/security/session";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (!isApproved(user)) {
    return pendingApproval();
  }

  const page = parseInteger(request.nextUrl.searchParams.get("page"), 1);
  const limit = parseInteger(request.nextUrl.searchParams.get("limit"), 10);
  const search = request.nextUrl.searchParams.get("search") ?? "";
  const result = await listClasses({ page, limit, search });

  return NextResponse.json(
    result,
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=300",
      },
    },
  );
}
