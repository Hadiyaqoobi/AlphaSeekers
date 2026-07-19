import { NextRequest, NextResponse } from "next/server";

import { createOpportunity, listOpportunities } from "@/lib/platform/store";
import { guardPermission } from "@/lib/security/api-guard";
import { withCors, corsPreflight } from "@/lib/security/cors";
import { getSessionUser, isApproved, pendingApproval, unauthorized } from "@/lib/security/session";

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  if (!user) {
    return withCors(unauthorized(), request);
  }

  if (!isApproved(user)) {
    return withCors(pendingApproval(), request);
  }

  const type = request.nextUrl.searchParams.get("type") ?? undefined;
  return withCors(NextResponse.json({ items: await listOpportunities(type) }), request);
}

export async function POST(request: NextRequest) {
  const g = await guardPermission("opportunities.edit");
  if (!g.ok) return g.response;

  const body = (await request.json()) as {
    title?: string;
    type?: "SCHOLARSHIP" | "JOB" | "INTERNSHIP" | "GRANT";
    description?: string;
    deadline?: string;
    externalUrl?: string;
  };

  if (!body.title || !body.type || !body.description || !body.deadline || !body.externalUrl) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
  }

  const opportunity = await createOpportunity({
    title: body.title,
    type: body.type,
    description: body.description,
    deadline: body.deadline,
    externalUrl: body.externalUrl,
  });

  return NextResponse.json(opportunity, { status: 201 });
}
