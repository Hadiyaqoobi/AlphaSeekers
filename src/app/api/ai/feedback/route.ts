/**
 * AI Feedback API Route
 *
 * Collects user feedback on AI study assistant responses.
 * This demonstrates AI evaluation thinking — critical for
 * an AI Solution Architect portfolio.
 *
 * In production, this would write to a database table for
 * analysis and model improvement. For now, we log to stdout
 * with structured JSON for observability.
 */

import { NextResponse } from "next/server";

import { updateCacheQuality } from "@/lib/ai/response-cache";
import { getSessionUser } from "@/lib/security/session";

type FeedbackPayload = {
  messageId: string;
  rating: "up" | "down";
  comment?: string;
};

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: FeedbackPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.messageId || !["up", "down"].includes(body.rating)) {
    return NextResponse.json(
      { error: "messageId and rating (up|down) are required" },
      { status: 400 },
    );
  }

  // Structured log for observability pipeline
  console.log(
    JSON.stringify({
      event: "ai_feedback",
      timestamp: new Date().toISOString(),
      userId: user.id,
      userRole: user.role,
      messageId: body.messageId,
      rating: body.rating,
      comment: body.comment ?? null,
    }),
  );

  // Update cache quality based on feedback (fire-and-forget)
  if (body.comment) {
    updateCacheQuality(body.comment, body.rating).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
