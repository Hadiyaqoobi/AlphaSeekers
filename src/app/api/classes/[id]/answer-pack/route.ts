/**
 * GET /api/classes/[id]/answer-pack
 *
 * Download this class's offline study pack: the class's own indexed material
 * plus the requesting student's OWN past Q&A for it (no other students'
 * questions — see pack-generator.ts). Student must be actively enrolled.
 */

import { prisma } from "@/lib/prisma";
import { generateAnswerPack } from "@/lib/ai/offline/pack-generator";
import { getSessionUser, unauthorized, forbidden } from "@/lib/security/session";
import { getAccessControl, can } from "@/lib/security/permissions";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await getAccessControl();
  if (!access) return unauthorized();

  // Staff with class-content management (classes.edit) can download any pack;
  // everyone else must be an active enrollee. A scoped employee (role=ADMIN
  // without classes.edit) no longer bypasses the enrollment check.
  const isStaff = can(access, "classes.edit");
  if (!isStaff) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_classId: { studentId: user.id, classId: params.id } },
    });
    if (!enrollment || enrollment.status !== "ACTIVE") {
      return forbidden("Not enrolled in this class");
    }
  }

  try {
    const pack = await generateAnswerPack(params.id, isStaff ? null : user.id);
    if (!pack) return Response.json({ message: "Class not found" }, { status: 404 });
    const safeFilename = pack.className.replace(/[^a-zA-Z0-9]+/g, "_");

    return new Response(JSON.stringify(pack, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${safeFilename}_offline_pack.json"`,
      },
    });
  } catch (error) {
    console.error("[Answer pack] failed:", error);
    return Response.json({ message: "Failed to generate pack" }, { status: 500 });
  }
}
