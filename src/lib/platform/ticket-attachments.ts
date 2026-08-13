import { prisma } from "@/lib/prisma";

export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Only raster screenshot formats. SVG is deliberately excluded: it is XML that
 * can carry script, and we serve these bytes back to admins from our own origin.
 */
const ALLOWED = new Map<string, { ext: string; matches: (b: Buffer) => boolean }>([
  ["image/png", { ext: "png", matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
  ["image/jpeg", { ext: "jpg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9 }],
  [
    "image/webp",
    {
      ext: "webp",
      matches: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
    },
  ],
]);

export type AttachmentRejection =
  | { ok: false; reason: "TOO_LARGE" }
  | { ok: false; reason: "UNSUPPORTED_TYPE" }
  | { ok: false; reason: "NOT_AN_IMAGE" };

/**
 * Trusting the browser-declared content type would let anything through, so the
 * bytes themselves must look like the format they claim to be.
 */
export function validateAttachment(
  bytes: Buffer,
  declaredType: string,
): { ok: true; contentType: string } | AttachmentRejection {
  if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) {
    return { ok: false, reason: "TOO_LARGE" };
  }
  const spec = ALLOWED.get(declaredType.toLowerCase());
  if (!spec) {
    return { ok: false, reason: "UNSUPPORTED_TYPE" };
  }
  if (!spec.matches(bytes)) {
    return { ok: false, reason: "NOT_AN_IMAGE" };
  }
  return { ok: true, contentType: declaredType.toLowerCase() };
}

export async function saveAttachment(input: {
  ticketId: string;
  filename: string;
  contentType: string;
  bytes: Buffer;
}) {
  // Prisma's Bytes field wants a Uint8Array backed by a plain ArrayBuffer;
  // Node's Buffer is typed as ArrayBufferLike, which does not satisfy it.
  const data = new Uint8Array(input.bytes);
  // One screenshot per ticket: re-uploading replaces rather than accumulates,
  // which keeps the storage cost predictable.
  return prisma.ticketAttachment.upsert({
    where: { ticketId: input.ticketId },
    create: {
      ticketId: input.ticketId,
      filename: input.filename.slice(0, 200),
      contentType: input.contentType,
      size: input.bytes.length,
      data,
    },
    update: {
      filename: input.filename.slice(0, 200),
      contentType: input.contentType,
      size: input.bytes.length,
      data,
    },
    select: { id: true, filename: true, contentType: true, size: true },
  });
}

export async function getAttachment(ticketId: string) {
  return prisma.ticketAttachment.findUnique({ where: { ticketId } });
}

/** Metadata only — never pull the bytes into a list or detail query. */
export async function getAttachmentMeta(ticketId: string) {
  return prisma.ticketAttachment.findUnique({
    where: { ticketId },
    select: { filename: true, contentType: true, size: true },
  });
}
