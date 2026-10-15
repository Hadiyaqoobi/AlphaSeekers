/**
 * POST /api/admin/certificates/[code]/revoke — cancel a certificate.
 *
 * Its verify page then says it was cancelled, and the person can be issued a
 * new one (for example after their name was corrected). Requires classes.edit.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { revokeCertificate } from "@/lib/platform/certificates";
import { recordAudit } from "@/lib/security/audit";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { getClientIp } from "@/lib/security/rate-limit";

type Params = { params: { code: string } };

const revokeSchema = z.object({ reason: z.string().max(300).nullish() });

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

  const parsed = revokeSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const revoked = await revokeCertificate(params.code, parsed.data.reason ?? null);
  if (!revoked) {
    return NextResponse.json({ message: "Certificate not found" }, { status: 404 });
  }

  await recordAudit({
    actorId: access.userId,
    actorEmail: access.email,
    action: "certificate.revoke",
    targetType: "Certificate",
    targetId: revoked.code,
    details: parsed.data.reason ?? null,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ message: "Certificate cancelled" });
}
