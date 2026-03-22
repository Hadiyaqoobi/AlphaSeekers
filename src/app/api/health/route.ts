import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "alphaseekers-platform",
    timestamp: new Date().toISOString(),
  });
}
