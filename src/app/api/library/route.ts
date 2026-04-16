import { NextRequest, NextResponse } from "next/server";

import { createLibraryResource, listLibraryResources } from "@/lib/platform/store";
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

  const query = request.nextUrl.searchParams.get("q") ?? undefined;
  return withCors(NextResponse.json({ items: await listLibraryResources(query) }), request);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ message: "Admin access only" }, { status: 403 });
  }

  const body = (await request.json()) as {
    title?: string;
    author?: string;
    category?: string;
    fileUrl?: string;
    fileSize?: number;
    externalUrl?: string;
  };

  if (!body.title || !body.author || !body.category || !body.fileUrl || !body.fileSize) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
  }

  if (body.fileSize > 5 * 1024 * 1024) {
    return NextResponse.json({ message: "File too large (max 5MB)" }, { status: 400 });
  }

  const resource = await createLibraryResource({
    title: body.title,
    author: body.author,
    category: body.category,
    fileUrl: body.fileUrl,
    fileSize: body.fileSize,
    externalUrl: body.externalUrl,
  });

  return NextResponse.json(resource, { status: 201 });
}
