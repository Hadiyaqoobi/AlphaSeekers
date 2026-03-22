import { NextRequest, NextResponse } from "next/server";

import { archiveClass, updateClass } from "@/lib/platform/store";
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

  const body = (await request.json()) as Record<string, unknown>;
  const updated = await updateClass(params.id, body);

  if (!updated) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ message: "Admin access only" }, { status: 403 });
  }

  const archived = await archiveClass(params.id);

  if (!archived) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Class archived", class: archived });
}
