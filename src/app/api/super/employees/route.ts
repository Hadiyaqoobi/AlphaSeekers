import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createEmployee, listEmployees } from "@/lib/platform/super-store";
import { recordAudit } from "@/lib/security/audit";
import { ACCESS_LEVELS, AccessError, requireSuperAdmin } from "@/lib/security/permissions";

export const dynamic = "force-dynamic";

/** Convert a thrown AccessError to a JSON response, other errors to a generic 500. */
function handleError(error: unknown): NextResponse {
  if (error instanceof AccessError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  console.error("[super/employees] unexpected error", error);
  return NextResponse.json({ message: "Internal server error" }, { status: 500 });
}

/** First IP from the x-forwarded-for header, if any. */
function clientIp(request: NextRequest): string | null {
  const header = request.headers.get("x-forwarded-for");
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  return first ? first : null;
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  accessLevel: z.enum(ACCESS_LEVELS),
  permissions: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json({ employees: await listEmployees() });
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

    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { name, email, accessLevel, permissions } = parsed.data;

    const result = await createEmployee({
      name,
      email,
      accessLevel,
      permissions,
      createdById: access.userId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await recordAudit({
      actorId: access.userId,
      actorEmail: access.email,
      action: "employee.create",
      targetType: "user",
      targetId: result.employee.id,
      details: JSON.stringify({
        accessLevel,
        permissionCount: result.employee.permissions.length,
      }),
      ipAddress: clientIp(request),
    });

    return NextResponse.json(
      { employee: result.employee, tempPassword: result.tempPassword },
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}
