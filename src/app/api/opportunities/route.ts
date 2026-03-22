import { NextRequest, NextResponse } from "next/server";

import { createOpportunity, listOpportunities } from "@/lib/platform/store";
import { getSessionUser, isApproved, pendingApproval, unauthorized } from "@/lib/security/session";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (!isApproved(user)) {
    return pendingApproval();
  }

  const type = request.nextUrl.searchParams.get("type") ?? undefined;
  return NextResponse.json({ items: await listOpportunities(type) });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ message: "Admin access only" }, { status: 403 });
  }

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
