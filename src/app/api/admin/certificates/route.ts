/**
 * POST /api/admin/certificates — issue one certificate without a class.
 *
 * For a course that never had a class on the platform (it ran on WhatsApp or
 * Meet only, or before the platform). Staff type the person, the class and the
 * teacher exactly as they should be printed. Requires classes.edit, like
 * issuing from a class page. A person who already holds a valid certificate
 * for the same course name is skipped, never duplicated.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { emailCertificateLinks, issueStandaloneCertificate } from "@/lib/platform/certificates";
import { recordAudit } from "@/lib/security/audit";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { getClientIp } from "@/lib/security/rate-limit";

const issueSchema = z.object({
  name: z.string().max(100),
  email: z.string().max(254).nullish(),
  kind: z.enum(["STUDENT_COMPLETION", "TEACHER_RECOGNITION"]),
  className: z.string().max(120),
  teacherName: z.string().max(100).nullish(),
  length: z.string().max(40).nullish(),
  term: z.string().max(60).nullish(),
  hours: z.string().max(40).nullish(),
  sendEmail: z.boolean().default(true),
});

const REASON_MESSAGES = {
  "class-not-found": ["Class not found", 404],
  "nobody-selected": ["Choose at least one person", 400],
  "not-in-class": ["Someone you chose is not enrolled in this class", 400],
  "name-missing": ["Type the person's full name", 400],
  "bad-email": ["That email address does not look right", 400],
  "class-name-missing": ["Type the class name", 400],
  "teacher-name-missing": ["Type the teacher's name", 400],
} as const;

export async function POST(request: NextRequest) {
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

  const result = await issueStandaloneCertificate({ ...input, issuedById: access.userId });
  if (!result.ok) {
    const [message, status] = REASON_MESSAGES[result.reason];
    return NextResponse.json({ message }, { status });
  }

  let emailed = 0;
  if (input.sendEmail && result.issued.length > 0) {
    emailed = await emailCertificateLinks(result.issued, input.className.trim());
  }

  if (result.issued.length > 0) {
    await recordAudit({
      actorId: access.userId,
      actorEmail: access.email,
      action: "certificate.issue",
      targetType: "Certificate",
      targetId: result.issued[0].code,
      details: JSON.stringify({ codes: result.issued.map((c) => c.code), standalone: true, emailed }),
      ipAddress: getClientIp(request),
    });
  }

  return NextResponse.json({
    issued: result.issued.length,
    alreadyHad: result.alreadyHad,
    emailed,
    code: result.issued[0]?.code ?? null,
  });
}
