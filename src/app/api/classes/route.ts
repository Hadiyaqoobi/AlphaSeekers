import { NextRequest, NextResponse } from "next/server";

import { listClasses, parseInteger } from "@/lib/platform/store";
import { withCors, corsPreflight } from "@/lib/security/cors";
import { getSessionUser, isApproved, pendingApproval, unauthorized } from "@/lib/security/session";

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  if (!user) {
    return withCors(unauthorized(), request);
  }

  if (!isApproved(user)) {
    return withCors(pendingApproval(), request);
  }

  const page = parseInteger(request.nextUrl.searchParams.get("page"), 1);
  const limit = parseInteger(request.nextUrl.searchParams.get("limit"), 10);
  const search = request.nextUrl.searchParams.get("search") ?? "";
  const result = await listClasses({ page, limit, search });

  return withCors(
    NextResponse.json(
      result,
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=300",
        },
      },
    ),
    request,
  );
}
