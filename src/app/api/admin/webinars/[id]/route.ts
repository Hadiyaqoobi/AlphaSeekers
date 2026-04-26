import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { forbidden, getSessionUser, unauthorized } from "@/lib/security/session";

type Params = { params: { id: string } };

export async function DELETE(_: Request, { params }: Params) {
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
