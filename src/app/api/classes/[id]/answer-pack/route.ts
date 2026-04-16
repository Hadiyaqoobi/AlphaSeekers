/**
 * GET /api/classes/[id]/answer-pack
 *
 * Download a JSON pack of the top Q&A for this class.
 * Student must be enrolled to download.
 */

import { prisma } from "@/lib/prisma";
import { generateAnswerPack } from "@/lib/ai/offline/pack-generator";
import { getSessionUser, unauthorized, forbidden } from "@/lib/security/session";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // Verify enrollment (admins can download any pack)
  if (user.role !== "ADMIN") {
    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_classId: { studentId: user.id, classId: params.id } },
    });
    if (!enrollment || enrollment.status !== "ACTIVE") {
      return forbidden("Not enrolled in this class");
    }
  }

  try {
    const pack = await generateAnswerPack(params.id);
    const safeFilename = pack.className.replace(/[^a-zA-Z0-9]+/g, "_");

    return new Response(JSON.stringify(pack, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${safeFilename}_offline_pack.json"`,
      },
    });
  } catch (error) {
    return Response.json(
      { message: (error as Error).message || "Failed to generate pack" },
      { status: 500 },
    );
  }
}
