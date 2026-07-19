import { NextRequest, NextResponse } from "next/server";

import { runSchedulerBatch } from "@/lib/platform/store";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export async function POST(request: NextRequest) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  const result = await runSchedulerBatch();
  return NextResponse.json(result);
}
