import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/security/session";

const VALID_CHANNELS = ["telegram", "webPush", "email"] as const;
const DEFAULTS = { telegram: true, webPush: true, email: true };

type NotificationPrefs = Record<string, boolean>;

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { notificationPrefs: true },
    });

    if (!dbUser?.notificationPrefs) {
      return NextResponse.json(DEFAULTS);
    }

    return NextResponse.json(JSON.parse(dbUser.notificationPrefs));
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as NotificationPrefs;

  const prefs: Record<string, boolean> = {};
  for (const channel of VALID_CHANNELS) {
    prefs[channel] = body[channel] !== false;
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { notificationPrefs: JSON.stringify(prefs) },
    });
    return NextResponse.json(prefs);
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
