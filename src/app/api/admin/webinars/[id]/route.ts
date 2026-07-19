import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { forbidden, getSessionUser, unauthorized } from "@/lib/security/session";

type Params = { params: { id: string } };

export async function DELETE(_: Request, { params }: Params) {
  try {
    await requirePermission("opportunities.edit");
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden("Admin access only");

  try {
    await prisma.webinar.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2025") {
      return NextResponse.json({ message: "Webinar not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Delete failed" }, { status: 500 });
  }
}
