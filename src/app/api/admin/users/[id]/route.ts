import { NextRequest, NextResponse } from "next/server";

import { setUserApproval } from "@/lib/platform/store";
import { getSessionUser, unauthorized } from "@/lib/security/session";

type Params = {
  params: { id: string };
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ message: "Admin access only" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { approved?: unknown };

  if (typeof body.approved !== "boolean") {
    return NextResponse.json({ message: "Missing or invalid approved flag" }, { status: 400 });
  }

  const updated = await setUserApproval(params.id, body.approved);

  if (!updated) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

