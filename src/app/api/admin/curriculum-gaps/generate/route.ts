/**
 * POST /api/admin/curriculum-gaps/generate
 *
 * Takes a detected curriculum gap and generates draft study material.
 * Teacher reviews before ingesting. Admin (ai.manage) or a teacher for one of
 * their own classes. Rate-limited: each call is a 2,000-token generation.
 */

import { prisma } from "@/lib/prisma";
import { aiConfig } from "@/lib/ai/config";
import { AccessError, getAccessControl, requirePermission } from "@/lib/security/permissions";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";
import { generateGapMaterial } from "@/lib/ai/curriculum/material-generator";
import type { CurriculumGap } from "@/lib/ai/curriculum/gap-detector";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "ADMIN" && user.role !== "TEACHER") {
    return forbidden("Admin or teacher access required");
  }
  const body = (await request.json().catch(() => null)) as Partial<CurriculumGap> | null;
  if (
    typeof body?.topic !== "string" ||
    !body.topic.trim() ||
    !Array.isArray(body.sampleQuestions) ||
    !body.sampleQuestions.every((q) => typeof q === "string")
  ) {
    return badRequest("Required: topic, sampleQuestions");
  }
  const classId = typeof body.classId === "string" && body.classId ? body.classId : null;

  // Admin employees need ai.manage; a teacher may only generate for a class they teach.
  let className: string | null = null;
  if (user.role === "ADMIN") {
    try {
      await requirePermission("ai.manage");
    } catch (e) {
      if (e instanceof AccessError) return Response.json({ message: e.message }, { status: e.status });
      throw e;
    }
  } else {
    const access = await getAccessControl();
    if (!access || access.deactivated) return forbidden("Account deactivated");
    if (!classId) return badRequest("Required: classId (one of your classes)");
  }
  if (classId) {
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { name: true, teacherId: true } });
    if (!cls || (user.role !== "ADMIN" && cls.teacherId !== user.id)) {
      return forbidden("You can only generate material for your own classes");
    }
    className = cls.name;
  }

  const rl = await checkRateLimitDistributed(`ai-teacher-gen:${user.id}`, aiConfig.rateLimits.teacherGenerate);
  if (!rl.allowed) {
    const retryAfter = Math.ceil(rl.retryAfterMs / 1000);
    return Response.json(
      { message: "Too many AI generations. Please wait before trying again.", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const gap: CurriculumGap = {
    topic: body.topic.slice(0, 200),
    questionCount: Number(body.questionCount) || 0,
    uniqueStudents: Number(body.uniqueStudents) || 0,
    badAnswerRatio: Number(body.badAnswerRatio ?? 1) || 0,
    sampleQuestions: body.sampleQuestions.slice(0, 5).map((q) => q.slice(0, 500)),
    classId,
    className,
    detectedAt: body.detectedAt ? new Date(body.detectedAt) : new Date(),
  };

  try {
    const material = await generateGapMaterial(gap);
    return Response.json(material);
  } catch (error) {
    console.error("[Curriculum] Material generation failed:", error);
    return Response.json({ message: "Failed to generate material" }, { status: 500 });
  }
}
