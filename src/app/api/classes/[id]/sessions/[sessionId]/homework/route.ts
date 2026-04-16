/**
 * GET  /api/classes/[id]/sessions/[sessionId]/homework — list assignments for this session
 * POST /api/classes/[id]/sessions/[sessionId]/homework — teacher creates an assignment
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { stripHtml } from "@/lib/security/sanitize";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";
import { checkSessionAccess } from "@/lib/session-access";

export async function GET(
  _request: Request,
  { params }: { params: { id: string; sessionId: string } },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await checkSessionAccess(user, params.id, params.sessionId);
  if (!access.ok) return Response.json({ message: access.message }, { status: access.status });

  const assignments = await prisma.homeworkAssignment.findMany({
    where: { sessionId: params.sessionId },
    orderBy: { createdAt: "desc" },
    include:
      access.role === "student"
        ? {
            submissions: {
              where: { studentId: user.id },
            },
          }
        : { submissions: true },
  });

  return Response.json({ assignments });
}

const createSchema = z.object({
  title: z.string().trim().min(3).max(200).transform(stripHtml).pipe(z.string().min(3)),
  description: z.string().trim().min(10).max(5000).transform(stripHtml).pipe(z.string().min(10)),
  dueDate: z.string().datetime().optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string; sessionId: string } },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await checkSessionAccess(user, params.id, params.sessionId);
  if (!access.ok) return Response.json({ message: access.message }, { status: access.status });
  if (access.role !== "teacher" && access.role !== "admin") {
    return forbidden("Only teachers can assign homework");
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid homework data");

  const assignment = await prisma.homeworkAssignment.create({
    data: {
      sessionId: params.sessionId,
      classId: params.id,
      title: parsed.data.title,
      description: parsed.data.description,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    },
  });

  return Response.json(assignment);
}
