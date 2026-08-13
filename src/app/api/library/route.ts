import { NextRequest, NextResponse } from "next/server";

import { normaliseHttpUrl } from "@/lib/security/safe-url";

import { createLibraryResource, listLibraryResources } from "@/lib/platform/store";
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

  const query = request.nextUrl.searchParams.get("q") ?? undefined;
  return withCors(NextResponse.json({ items: await listLibraryResources(query) }), request);
}

export async function POST(request: NextRequest) {
  const g = await guardPermission("library.edit");
  if (!g.ok) return g.response;

  const body = (await request.json()) as {
    title?: string;
    author?: string;
    category?: string;
    fileUrl?: string;
    fileSize?: number;
    externalUrl?: string;
  };

  if (!body.title || !body.author || !body.category) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
  }

  // A resource is reachable either by uploaded file or by external link, and
  // both are rendered as hrefs -- so both must be http(s), and at least one
  // must be present or the entry points nowhere.
  const fileUrl = normaliseHttpUrl(body.fileUrl);
  const externalUrl = normaliseHttpUrl(body.externalUrl);
  if (!fileUrl && !externalUrl) {
    return NextResponse.json(
      { message: "A valid http(s) file link or external link is required" },
      { status: 400 },
    );
  }

  const fileSize = typeof body.fileSize === "number" && body.fileSize > 0 ? body.fileSize : 0;
  if (fileSize > 5 * 1024 * 1024) {
    return NextResponse.json({ message: "File too large (max 5MB)" }, { status: 400 });
  }

  const resource = await createLibraryResource({
    title: body.title,
    author: body.author,
    category: body.category,
    fileUrl: fileUrl ?? undefined,
    fileSize,
    externalUrl: externalUrl ?? undefined,
  });

  return NextResponse.json(resource, { status: 201 });
}
