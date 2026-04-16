/**
 * POST /api/classes/[id]/sessions/[sessionId]/recording
 *
 * Teacher uploads a class recording transcript (or audio).
 * The transcript is chunked, embedded, and stored in the vector store
 * so future AI queries can answer "What did the teacher say in Tuesday's class?"
 *
 * Two payload modes:
 *   1. JSON: { transcript: "..." }                (manual transcript paste)
 *   2. multipart/form-data with file              (audio file → Whisper)
 */

import { prisma } from "@/lib/prisma";
import { ingestRecording } from "@/lib/ai/session/recording-processor";
import { aiConfig } from "@/lib/ai/config";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";
import { checkSessionAccess } from "@/lib/session-access";

export async function POST(
  request: Request,
  { params }: { params: { id: string; sessionId: string } },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await checkSessionAccess(user, params.id, params.sessionId);
  if (!access.ok) return Response.json({ message: access.message }, { status: access.status });
  if (access.role !== "teacher" && access.role !== "admin") {
    return forbidden("Only teachers can upload recordings");
  }

  if (!aiConfig.enabled) {
    return Response.json({ message: "AI features not configured" }, { status: 503 });
  }

  const session = await prisma.session.findUnique({
    where: { id: params.sessionId },
    include: { class: { select: { name: true } } },
  });
  if (!session) return Response.json({ message: "Session not found" }, { status: 404 });

  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      // Audio file path
      const formData = await request.formData();
      const file = formData.get("audio") as File | null;
      const language = (formData.get("language") as "en" | "fa") || "en";

      if (!file) return badRequest("No audio file provided");
      if (file.size > 50 * 1024 * 1024) return badRequest("Audio file must be under 50MB");

      const result = await ingestRecording({
        sessionId: params.sessionId,
        classId: params.id,
        className: session.class.name,
        sessionDate: session.startTime,
        audioFile: file,
        audioMimeType: file.type,
        language,
      });

      return Response.json({ ok: true, ...result });
    }

    // JSON path (manual transcript)
    const body = await request.json().catch(() => null);
    const transcript = body?.transcript;
    if (typeof transcript !== "string" || transcript.trim().length < 50) {
      return badRequest("Transcript must be at least 50 characters");
    }

    const result = await ingestRecording({
      sessionId: params.sessionId,
      classId: params.id,
      className: session.class.name,
      sessionDate: session.startTime,
      transcript,
    });

    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Recording] Ingestion failed:", err);
    return Response.json(
      { message: (err as Error).message || "Failed to process recording" },
      { status: 500 },
    );
  }
}
