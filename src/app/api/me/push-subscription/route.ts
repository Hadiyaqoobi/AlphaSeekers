import { NextRequest, NextResponse } from "next/server";

import { isAllowedPushEndpoint } from "@/lib/security/safe-url";
import { getSessionUser } from "@/lib/security/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const subscription = await request.json().catch(() => null);

  if (!subscription?.endpoint || !isAllowedPushEndpoint(subscription.endpoint)) {
    return NextResponse.json({ message: "Invalid subscription" }, { status: 400 });
  }

  // Keep only what web-push reads, so the row cannot be used to park an
  // arbitrary blob of JSON on the user record.
  const keys = subscription.keys ?? {};
  if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
    return NextResponse.json({ message: "Invalid subscription" }, { status: 400 });
  }
  const stored = {
    endpoint: subscription.endpoint as string,
    expirationTime: typeof subscription.expirationTime === "number" ? subscription.expirationTime : null,
    keys: { p256dh: keys.p256dh.slice(0, 200), auth: keys.auth.slice(0, 200) },
  };

  await prisma.user.update({
    where: { id: user.id },
    data: { pushSubscription: JSON.stringify(stored) },
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
