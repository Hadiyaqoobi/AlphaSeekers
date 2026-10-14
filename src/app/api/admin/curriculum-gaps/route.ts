/**
 * GET /api/admin/curriculum-gaps?days=7
 *
 * Returns topics where students asked questions but the vector store
 * had no good answers. Admin (ai.manage) sees every class; a teacher sees only
 * questions tagged with classes they teach. `days` is capped at 30.
 */

import { prisma } from "@/lib/prisma";
import { AccessError, getAccessControl, requirePermission } from "@/lib/security/permissions";
import { getSessionUser, unauthorized, forbidden } from "@/lib/security/session";
import { clampGapDays, detectCurriculumGaps } from "@/lib/ai/curriculum/gap-detector";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "ADMIN" && user.role !== "TEACHER") {
    return forbidden("Admin or teacher access required");
  }
  // Admin employees need ai.manage (all classes); teachers see their own classes.
  let classIds: string[] | undefined;
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
    const classes = await prisma.class.findMany({ where: { teacherId: user.id }, select: { id: true } });
    classIds = classes.map((c) => c.id);
  }

  const { searchParams } = new URL(request.url);
  const days = clampGapDays(searchParams.get("days"));

  const gaps = await detectCurriculumGaps({ days, classIds });

  return Response.json({
    period: `${days} days`,
    totalGaps: gaps.length,
    gaps,
  });
}
