import { NextRequest, NextResponse } from "next/server";

import { runSchedulerBatch } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

async function hasCronAccess(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret) {
    return true;
  }

  if (request.headers.get("x-cron-secret") === configuredSecret) {
    return true;
  }

  const user = await getSessionUser();
  return user?.role === "ADMIN";
}

export async function POST(request: NextRequest) {
  if (!(await hasCronAccess(request))) {
    return NextResponse.json({ message: "Unauthorized cron call" }, { status: 401 });
  }

  const result = await runSchedulerBatch();
  return NextResponse.json(result);
}
