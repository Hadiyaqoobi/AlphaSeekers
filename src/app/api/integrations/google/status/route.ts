import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/security/session";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  const link = await prisma.googleAccountLink.findUnique({
    where: {
      userId: user.id,
    },
    select: {
      googleEmail: true,
      updatedAt: true,
      calendarId: true,
    },
  });

  return NextResponse.json({
    connected: Boolean(link),
    accountEmail: link?.googleEmail ?? null,
    calendarId: link?.calendarId ?? null,
    connectedAt: link?.updatedAt.toISOString() ?? null,
  });
}
