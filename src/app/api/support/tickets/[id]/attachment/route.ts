import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  MAX_ATTACHMENT_BYTES,
  getAttachment,
  saveAttachment,
  validateAttachment,
} from "@/lib/platform/ticket-attachments";
import { AccessError, requirePermission } from "@/lib/security/permissions";

const REJECTION_MESSAGES: Record<string, string> = {
  TOO_LARGE: `Image must be between 1 byte and ${Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB.`,
  UNSUPPORTED_TYPE: "Only PNG, JPEG and WebP screenshots are supported.",
  NOT_AN_IMAGE: "That file does not look like a valid image.",
};

function accessErrorResponse(e: unknown) {
  if (e instanceof AccessError) {
    return NextResponse.json({ message: e.message }, { status: e.status });
  }
  return null;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission("support.create");
  } catch (e) {
    const res = accessErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!ticket) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
  }

  // Guard before buffering: a declared size over the cap never reaches memory.
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ message: REJECTION_MESSAGES.TOO_LARGE }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const verdict = validateAttachment(bytes, file.type || "");
  if (!verdict.ok) {
    return NextResponse.json(
      { message: REJECTION_MESSAGES[verdict.reason] },
      { status: verdict.reason === "TOO_LARGE" ? 413 : 415 },
    );
  }

  const saved = await saveAttachment({
    ticketId: params.id,
    filename: file.name || "screenshot",
    contentType: verdict.contentType,
    bytes,
  });

  return NextResponse.json({ attachment: saved }, { status: 201 });
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission("support.view");
  } catch (e) {
    const res = accessErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const attachment = await getAttachment(params.id);
  if (!attachment) return NextResponse.json({ message: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(attachment.data), {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Length": String(attachment.size),
      // These bytes came from a user. Never let the browser sniff a different
      // type, and never render them as a document on our origin.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.filename)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
