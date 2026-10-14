/**
 * AI Feedback API Route
 *
 * Thumbs up/down on a study-assistant answer.
 *
 * Body: { messageId, rating: "up" | "down", comment? }
 *   messageId = the interactionId the answer stream sent in its "done" event
 *   (= AIInteraction.id).
 *
 * Effects:
 *   - AIInteraction.rating = "positive" | "negative" (only the asker's own row).
 *     Negative ratings are what the pre-class prep message and the student
 *     context read as "struggled with this topic".
 *   - The per-user cached copy of that answer has its quality adjusted (and is
 *     dropped once it is consistently rated down).
 */

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { updateCacheQuality } from "@/lib/ai/response-cache";
import { getSessionUser } from "@/lib/security/session";

type FeedbackPayload = {
  messageId?: unknown;
  rating?: unknown;
  comment?: unknown;
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

  const messageId = typeof body.messageId === "string" ? body.messageId.slice(0, 64) : "";
  const rating = body.rating === "up" || body.rating === "down" ? body.rating : null;
  if (!messageId || !rating) {
    return NextResponse.json(
      { error: "messageId and rating (up|down) are required" },
      { status: 400 },
    );
  }

  // Scoped to the caller's own interaction: nobody can rate someone else's.
  const updated = await prisma.aIInteraction.updateMany({
    where: { id: messageId, userId: user.id },
    data: { rating: rating === "up" ? "positive" : "negative" },
  });

  // Structured log for observability pipeline
  console.log(
    JSON.stringify({
      event: "ai_feedback",
      timestamp: new Date().toISOString(),
      userId: user.id,
      messageId,
      rating,
      recorded: updated.count > 0,
    }),
  );

  if (updated.count > 0) {
    // Re-derive the cache scope the answer was stored under (user + enrolled
    // classes) so the quality signal reaches the right entry. Fire-and-forget.
    void (async () => {
      const [interaction, enrollments] = await Promise.all([
        prisma.aIInteraction.findUnique({ where: { id: messageId }, select: { query: true } }),
        prisma.enrollment.findMany({
          where: { studentId: user.id, status: "ACTIVE" },
          select: { classId: true },
        }),
      ]);
      if (!interaction) return;
      await updateCacheQuality(interaction.query, rating, {
        userId: user.id,
        classScope: enrollments.map((e) => e.classId),
      });
    })().catch(() => {});
  }

  return NextResponse.json({ success: true, recorded: updated.count > 0 });
}
