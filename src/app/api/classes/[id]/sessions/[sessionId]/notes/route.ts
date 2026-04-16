/**
 * GET /api/classes/[id]/sessions/[sessionId]/notes  — fetch the student's notes
 * PUT /api/classes/[id]/sessions/[sessionId]/notes  — auto-save notes
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
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
  if (access.role !== "student") return forbidden("Notes are personal to students");

  const notes = await prisma.sessionNote.findUnique({
    where: { sessionId_studentId: { sessionId: params.sessionId, studentId: user.id } },
  });

  return Response.json({ content: notes?.content ?? "", updatedAt: notes?.updatedAt ?? null });
}

const updateSchema = z.object({
  content: z.string().max(50000),
});

export async function PUT(
  request: Request,
  { params }: { params: { id: string; sessionId: string } },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await checkSessionAccess(user, params.id, params.sessionId);
  if (!access.ok) return Response.json({ message: access.message }, { status: access.status });
  if (access.role !== "student") return forbidden("Only students can save their notes");

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid notes content");

  const note = await prisma.sessionNote.upsert({
    where: { sessionId_studentId: { sessionId: params.sessionId, studentId: user.id } },
    update: { content: parsed.data.content },
    create: {
      sessionId: params.sessionId,
      studentId: user.id,
      content: parsed.data.content,
    },
  });

  return Response.json({ ok: true, updatedAt: note.updatedAt });
}
