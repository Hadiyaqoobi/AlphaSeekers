/**
 * GET /api/admin/curriculum-gaps?days=7
 *
 * Returns topics where students asked questions but the vector store
 * had no good answers. Admin/teacher only.
 */

import { getSessionUser, unauthorized, forbidden } from "@/lib/security/session";
import { detectCurriculumGaps } from "@/lib/ai/curriculum/gap-detector";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "ADMIN" && user.role !== "TEACHER") {
    return forbidden("Admin or teacher access required");
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7", 10);

  const gaps = await detectCurriculumGaps({ days });

  return Response.json({
    period: `${days} days`,
    totalGaps: gaps.length,
    gaps,
  });
}
