import { NextResponse } from "next/server";

import { listUserNotifications } from "@/lib/platform/store";
import { getSessionUser, unauthorized } from "@/lib/security/session";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  return NextResponse.json({ items: (await listUserNotifications(user.id)).slice(0, 20) });
}
