import { NextRequest, NextResponse } from "next/server";

import { listAdminUsers, parseInteger } from "@/lib/platform/store";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { getSessionUser, unauthorized } from "@/lib/security/session";

const ROLE_FILTERS = ["STUDENT", "TEACHER", "ADMIN", "ALL"] as const;
const STATUS_FILTERS = ["PENDING", "APPROVED", "ALL"] as const;

type RoleFilter = (typeof ROLE_FILTERS)[number];
type StatusFilter = (typeof STATUS_FILTERS)[number];

function parseRoleFilter(input: string | null): RoleFilter {
  const value = (input ?? "ALL").toUpperCase();
  return (ROLE_FILTERS as readonly string[]).includes(value) ? (value as RoleFilter) : "ALL";
}

function parseStatusFilter(input: string | null): StatusFilter {
  const value = (input ?? "PENDING").toUpperCase();
  return (STATUS_FILTERS as readonly string[]).includes(value) ? (value as StatusFilter) : "PENDING";
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("users.view");
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ message: "Admin access only" }, { status: 403 });
  }

  const page = parseInteger(request.nextUrl.searchParams.get("page"), 1);
  const limit = parseInteger(request.nextUrl.searchParams.get("limit"), 10);
  const search = request.nextUrl.searchParams.get("search") ?? "";
  const role = parseRoleFilter(request.nextUrl.searchParams.get("role"));
  const status = parseStatusFilter(request.nextUrl.searchParams.get("status"));

  return NextResponse.json(await listAdminUsers({ page, limit, search, role, status }));
}

