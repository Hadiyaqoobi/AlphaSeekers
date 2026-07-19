import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { setEmployeeDeactivated, updateEmployeeAccess } from "@/lib/platform/super-store";
import { recordAudit } from "@/lib/security/audit";
import { ACCESS_LEVELS, AccessError, requireSuperAdmin } from "@/lib/security/permissions";

export const dynamic = "force-dynamic";

/** Convert a thrown AccessError to a JSON response, other errors to a generic 500. */
function handleError(error: unknown): NextResponse {
  if (error instanceof AccessError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  console.error("[super/employees/[id]] unexpected error", error);
  return NextResponse.json({ message: "Internal server error" }, { status: 500 });
}

/** First IP from the x-forwarded-for header, if any. */
function clientIp(request: NextRequest): string | null {
  const header = request.headers.get("x-forwarded-for");
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  return first ? first : null;
}

const patchSchema = z
  .object({
    accessLevel: z.enum(ACCESS_LEVELS).optional(),
    permissions: z.array(z.string()).optional(),
    deactivated: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.accessLevel !== undefined ||
      v.permissions !== undefined ||
      v.deactivated !== undefined,
    { message: "No changes supplied" },
  );

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const access = await requireSuperAdmin();
    const { id } = params;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { accessLevel, permissions, deactivated } = parsed.data;
    const ipAddress = clientIp(request);

    // Deactivation / reactivation.
    if (deactivated !== undefined) {
      const result = await setEmployeeDeactivated(id, deactivated);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      await recordAudit({
        actorId: access.userId,
        actorEmail: access.email,
        action: deactivated ? "employee.deactivate" : "employee.reactivate",
        targetType: "user",
        targetId: id,
        details: JSON.stringify({ deactivated }),
        ipAddress,
      });
    }

    // Access-level / permission changes.
    if (accessLevel !== undefined || permissions !== undefined) {
      const result = await updateEmployeeAccess(id, {
        ...(accessLevel !== undefined ? { accessLevel } : {}),
        ...(permissions !== undefined ? { permissions } : {}),
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      await recordAudit({
        actorId: access.userId,
        actorEmail: access.email,
        action: "employee.update",
        targetType: "user",
        targetId: id,
        details: JSON.stringify({
          ...(accessLevel !== undefined ? { accessLevel } : {}),
          ...(permissions !== undefined ? { permissionCount: permissions.length } : {}),
        }),
        ipAddress,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
