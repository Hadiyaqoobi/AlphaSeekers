import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/security/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const subscription = await request.json();

  if (!subscription?.endpoint) {
    return NextResponse.json({ message: "Invalid subscription" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { pushSubscription: JSON.stringify(subscription) },
  });

  return NextResponse.json({ saved: true });
}

export async function DELETE() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { pushSubscription: null },
  });

  return NextResponse.json({ removed: true });
}
