/**
 * POST /api/admin/classes/[id]/certificates — issue certificates for a class.
 *
 * Staff pick who gets one (enrolled students and/or the class's teacher) and
 * can adjust the printed wording. Requires classes.edit. Anyone who already
 * holds a valid certificate for this class is skipped, never duplicated.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { emailCertificateLinks, issueCertificates } from "@/lib/platform/certificates";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/security/audit";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { getClientIp } from "@/lib/security/rate-limit";

type Params = { params: { id: string } };

const issueSchema = z.object({
  studentIds: z.array(z.string().min(1).max(64)).max(500).default([]),
  includeTeacher: z.boolean().default(false),
  length: z.string().max(40).nullish(),
  term: z.string().max(60).nullish(),
  hours: z.string().max(40).nullish(),
  sendEmail: z.boolean().default(true),
});

const REASON_MESSAGES = {
  "class-not-found": ["Class not found", 404],
  "nobody-selected": ["Choose at least one person", 400],
  "not-in-class": ["Someone you chose is not enrolled in this class", 400],
} as const;

export async function POST(request: NextRequest, { params }: Params) {
  let access;
  try {
    access = await requirePermission("classes.edit");
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }
  // Staff only, even if a non-staff row somehow carried a permission list.
  if (!access.isAdmin) {
    return NextResponse.json({ message: "Admin access only" }, { status: 403 });
  }

  const parsed = issueSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  const input = parsed.data;

  const result = await issueCertificates({
    classId: params.id,
    issuedById: access.userId,
    studentIds: input.studentIds,
    includeTeacher: input.includeTeacher,
    length: input.length,
    term: input.term,
    hours: input.hours,
  });
  if (!result.ok) {
    const [message, status] = REASON_MESSAGES[result.reason];
    return NextResponse.json({ message }, { status });
  }

  let emailed = 0;
  if (input.sendEmail && result.issued.length > 0) {
    const klass = await prisma.class.findUnique({ where: { id: params.id }, select: { name: true } });
    emailed = await emailCertificateLinks(result.issued, klass?.name ?? "your class");
  }

  if (result.issued.length > 0) {
    await recordAudit({
      actorId: access.userId,
      actorEmail: access.email,
      action: "certificate.issue",
      targetType: "Class",
      targetId: params.id,
      details: JSON.stringify({ codes: result.issued.map((c) => c.code), emailed }),
      ipAddress: getClientIp(request),
    });
  }

  return NextResponse.json({ issued: result.issued.length, alreadyHad: result.alreadyHad, emailed });
}
