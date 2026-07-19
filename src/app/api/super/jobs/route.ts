import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listDeadJobs, queueHealth, requeueJob } from "@/lib/jobs/queue";
import { recordAudit } from "@/lib/security/audit";
import { AccessError, requireSuperAdmin } from "@/lib/security/permissions";

export const dynamic = "force-dynamic";

/** Convert a thrown AccessError to a JSON response, other errors to a generic 500. */
function handleError(error: unknown): NextResponse {
  if (error instanceof AccessError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  console.error("[super/jobs] unexpected error", error);
  return NextResponse.json({ message: "Internal server error" }, { status: 500 });
}

/** First IP from the x-forwarded-for header, if any. */
function clientIp(request: NextRequest): string | null {
  const header = request.headers.get("x-forwarded-for");
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  return first ? first : null;
}

const actionSchema = z.object({
  action: z.literal("requeue"),
  jobId: z.string().min(1, "jobId is required"),
});

export async function GET() {
  try {
    await requireSuperAdmin();

    const [health, dead] = await Promise.all([queueHealth(), listDeadJobs(50)]);

    return NextResponse.json({
      health,
      // Serialize Date -> ISO so the wire shape matches the client component's type.
      dead: dead.map((j) => ({
        id: j.id,
        type: j.type,
        attempts: j.attempts,
        lastError: j.lastError,
        updatedAt: j.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireSuperAdmin();

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = actionSchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { jobId } = parsed.data;
    const { ok } = await requeueJob(jobId);

    await recordAudit({
      actorId: access.userId,
      actorEmail: access.email,
      action: "job.requeue",
      targetType: "job",
      targetId: jobId,
      details: JSON.stringify({ ok }),
      ipAddress: clientIp(request),
    });

    return NextResponse.json({ ok });
  } catch (error) {
    return handleError(error);
  }
}
