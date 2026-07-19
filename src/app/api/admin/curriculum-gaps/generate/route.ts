/**
 * POST /api/admin/curriculum-gaps/generate
 *
 * Takes a detected curriculum gap and generates draft study material.
 * Teacher reviews before ingesting. Admin/teacher only.
 */

import { AccessError, requirePermission } from "@/lib/security/permissions";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";
import { generateGapMaterial } from "@/lib/ai/curriculum/material-generator";
import type { CurriculumGap } from "@/lib/ai/curriculum/gap-detector";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "ADMIN" && user.role !== "TEACHER") {
    return forbidden("Admin or teacher access required");
  }
  // Scope admin employees by permission; teachers keep their existing access.
  if (user.role === "ADMIN") {
    try {
      await requirePermission("ai.manage");
    } catch (e) {
      if (e instanceof AccessError) return Response.json({ message: e.message }, { status: e.status });
      throw e;
    }
  }

  const body = (await request.json().catch(() => null)) as Partial<CurriculumGap> | null;
  if (!body?.topic || !body?.sampleQuestions) {
    return badRequest("Required: topic, sampleQuestions");
  }

  const gap: CurriculumGap = {
    topic: body.topic,
    questionCount: body.questionCount ?? 0,
    uniqueStudents: body.uniqueStudents ?? 0,
    badAnswerRatio: body.badAnswerRatio ?? 1,
    sampleQuestions: body.sampleQuestions,
    classId: body.classId ?? null,
    className: body.className ?? null,
    detectedAt: body.detectedAt ? new Date(body.detectedAt) : new Date(),
  };

  try {
    const material = await generateGapMaterial(gap);
    return Response.json(material);
  } catch (error) {
    console.error("[Curriculum] Material generation failed:", error);
    return Response.json(
      { message: (error as Error).message || "Failed to generate material" },
      { status: 500 },
    );
  }
}
