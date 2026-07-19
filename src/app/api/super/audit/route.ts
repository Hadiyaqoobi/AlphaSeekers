import { NextRequest, NextResponse } from "next/server";

import { listAuditLog } from "@/lib/security/audit";
import { AccessError, requireSuperAdmin } from "@/lib/security/permissions";

export const dynamic = "force-dynamic";

/** Convert a thrown AccessError to a JSON response, other errors to a generic 500. */
function handleError(error: unknown): NextResponse {
  if (error instanceof AccessError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  console.error("[super/audit] unexpected error", error);
  return NextResponse.json({ message: "Internal server error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const cursorParam = request.nextUrl.searchParams.get("cursor");
    const limitParam = request.nextUrl.searchParams.get("limit");

    const cursor = cursorParam ?? undefined;
    let limit: number | undefined;
    if (limitParam !== null) {
      const parsed = Number.parseInt(limitParam, 10);
      if (Number.isFinite(parsed)) limit = parsed;
    }

    return NextResponse.json(await listAuditLog({ cursor, limit }));
  } catch (error) {
    return handleError(error);
  }
}
