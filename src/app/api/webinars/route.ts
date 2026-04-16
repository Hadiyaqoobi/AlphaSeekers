import { NextRequest, NextResponse } from "next/server";

import { createWebinar, listRegisteredWebinarIds, listWebinars } from "@/lib/platform/store";
import { withCors, corsPreflight } from "@/lib/security/cors";
import { getSessionUser, isApproved, pendingApproval, unauthorized } from "@/lib/security/session";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return withCors(unauthorized(), request);
  }

  if (!isApproved(user)) {
    return withCors(pendingApproval(), request);
  }

  const items = await listWebinars();

  if (user.role === "ADMIN") {
    return withCors(NextResponse.json({ items }), request);
  }

  const registeredIds = new Set(await listRegisteredWebinarIds(user.id));
  const safe = items.map((item) => ({
    ...item,
    meetLink: registeredIds.has(item.id) ? item.meetLink : null,
    registered: registeredIds.has(item.id),
  }));

  return withCors(NextResponse.json({ items: safe }), request);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ message: "Admin access only" }, { status: 403 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    startsAt?: string;
    meetLink?: string;
    language?: string;
  };

  if (!body.title || !body.description || !body.startsAt || !body.meetLink) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
  }

  const webinar = await createWebinar({
    title: body.title,
    description: body.description,
    startsAt: body.startsAt,
    meetLink: body.meetLink,
    language: body.language ?? "Dari",
  });

  return NextResponse.json(webinar, { status: 201 });
}
