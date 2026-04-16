import { NextResponse } from "next/server";

import { withCors, corsPreflight } from "@/lib/security/cors";

export async function GET(request: Request) {
  return withCors(
    NextResponse.json({
      ok: true,
      service: "alphaseekers-platform",
      timestamp: new Date().toISOString(),
    }),
    request,
  );
}

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}
