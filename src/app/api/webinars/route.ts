import { NextRequest, NextResponse } from "next/server";

import { createWebinar, listRegisteredWebinarIds, listWebinars } from "@/lib/platform/store";
import { guardPermission } from "@/lib/security/api-guard";
import { withCors, corsPreflight } from "@/lib/security/cors";
import { can, getAccessControl } from "@/lib/security/permissions";
import { normaliseHttpUrl } from "@/lib/security/safe-url";
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

  // Every Meet link only for staff who manage webinars — role=ADMIN alone is
  // every scoped employee (moderators, finance, support).
  if (user.role === "ADMIN" && can(await getAccessControl(), "opportunities.view")) {
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
  const g = await guardPermission("opportunities.edit");
  if (!g.ok) return g.response;

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

  // Rendered as a link students click: http(s) only, never javascript:.
  const meetLink = normaliseHttpUrl(body.meetLink);
  if (!meetLink) {
    return NextResponse.json({ message: "The meeting link must be an http(s) URL" }, { status: 400 });
  }

  const webinar = await createWebinar({
    title: body.title,
    description: body.description,
    startsAt: body.startsAt,
    meetLink,
    language: body.language ?? "Dari",
  });

  return NextResponse.json(webinar, { status: 201 });
}
