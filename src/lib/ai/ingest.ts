/**
 * Course-material ingestion: text → chunks → embeddings → pgvector.
 *
 * Before this module, NOTHING indexed course material automatically — the only
 * way in was a hand-written admin API call — so the study assistant answered
 * every question from general knowledge. Now:
 *
 *   - ingestDocument(): shared by the admin ingest route and material ingest.
 *     Skips the embedding calls entirely when the source's chunks are unchanged.
 *   - ingestMaterial(materialId): downloads an uploaded material and indexes it
 *     under its class.
 *   - scheduleMaterialIngest(materialId): fire-and-forget wrapper for upload
 *     routes. Embedding a document takes many rate-limited calls, so it must
 *     never hold the teacher's upload request open. (Render runs one long-lived
 *     Node server, so a detached promise finishes after the response is sent.)
 *
 * WHAT CAN BE INDEXED: plain text, Markdown, CSV and HTML files that were
 * uploaded to our own R2 bucket. PDFs, Word files and pasted external links
 * (Google Drive, OneDrive, ...) are skipped with a logged reason — there is no
 * PDF/DOCX text extractor in the dependency tree yet, and fetching arbitrary
 * teacher-supplied URLs from the server would be an SSRF hole.
 */

import sanitizeHtml from "sanitize-html";

import { createPresignedDownloadUrl, isR2Configured } from "@/lib/integrations/r2";
import { prisma } from "@/lib/prisma";

import { chunkDocument, type DocumentChunkInput } from "./chunker";
import { aiConfig } from "./config";
import { generateEmbeddings } from "./embeddings";
import { invalidateCache } from "./response-cache";
import { ensureVectorExtension, getSourceChunks, replaceChunksForSource } from "./vector-store";

export type IngestStatus = "indexed" | "unchanged" | "empty" | "skipped";

export type IngestResult = {
  status: IngestStatus;
  chunksCreated: number;
  totalTokens: number;
  /** Why nothing was indexed (status "skipped"). */
  reason?: string;
  /** Text was longer than aiConfig.limits.ingestMaxChars and was cut. */
  truncated?: boolean;
};

export function generateChunkId(sourceId: string, chunkIndex: number): string {
  return `chunk_${sourceId}_${chunkIndex}`;
}

/**
 * True when the freshly chunked text is exactly what is already stored for
 * the source (same chunk texts in the same order, same title and class).
 */
export function chunksUnchanged(
  existing: Array<{ content: string; sourceTitle: string; classId: string | null }>,
  next: Array<{ content: string; sourceTitle: string }>,
  classId: string | null,
): boolean {
  if (existing.length === 0 || existing.length !== next.length) return false;
  return existing.every(
    (row, i) =>
      row.content === next[i].content &&
      row.sourceTitle === next[i].sourceTitle &&
      (row.classId ?? null) === classId,
  );
}

/**
 * Chunk, embed and store one document, replacing whatever the source had.
 * Embeddings are generated BEFORE the old chunks are touched, and the swap is
 * one transaction, so a failure leaves the previous version searchable.
 */
export async function ingestDocument(
  input: DocumentChunkInput & { classId?: string | null; force?: boolean },
): Promise<IngestResult> {
  const classId = input.classId ?? null;
  const maxChars = aiConfig.limits.ingestMaxChars;
  const truncated = input.content.length > maxChars;
  const content = truncated ? input.content.slice(0, maxChars) : input.content;

  const chunks = chunkDocument({ ...input, content });
  if (chunks.length === 0) {
    return { status: "empty", chunksCreated: 0, totalTokens: 0 };
  }
  const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

  if (!input.force) {
    const existing = await getSourceChunks(input.sourceType, input.sourceId);
    if (chunksUnchanged(existing, chunks, classId)) {
      return { status: "unchanged", chunksCreated: 0, totalTokens, truncated };
    }
  }

  await ensureVectorExtension();
  const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

  const inserted = await replaceChunksForSource(
    input.sourceType,
    input.sourceId,
    chunks.map((chunk, i) => ({
      id: generateChunkId(input.sourceId, chunk.chunkIndex),
      sourceType: chunk.sourceType,
      sourceId: chunk.sourceId,
      sourceTitle: chunk.sourceTitle,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      tokenCount: chunk.tokenCount,
      embedding: embeddings[i],
      classId,
    })),
  );

  // Materials changed → cached answers derived from the old text must expire.
  await invalidateCache().catch(() => {});

  return { status: "indexed", chunksCreated: inserted, totalTokens, truncated };
}

// ── Material download + text extraction ──────────────────────────────────────

const MAX_MATERIAL_BYTES = 5 * 1024 * 1024; // same cap as the upload route

const TEXT_EXTENSIONS: Record<string, "text" | "html"> = {
  txt: "text",
  md: "text",
  markdown: "text",
  csv: "text",
  html: "html",
  htm: "html",
};

/**
 * Decide how to read a file from its Content-Type (falling back to the URL's
 * extension when the type is generic). Returns null for formats we cannot
 * turn into text (PDF, DOCX, images, ...).
 */
export function textKindFor(contentType: string | null, url: string): "text" | "html" | null {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (type === "text/html" || type === "application/xhtml+xml") return "html";
  if (type.startsWith("text/")) return "text";

  if (type === "" || type === "application/octet-stream" || type === "binary/octet-stream") {
    const path = url.split(/[?#]/)[0];
    const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
    return TEXT_EXTENSIONS[ext] ?? null;
  }
  return null;
}

/** Plain text out of an HTML document (scripts/styles dropped). */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&") // last, so "&amp;lt;" stays the literal text "&lt;"
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The R2 object key for a URL in OUR bucket, or null for any other URL. */
export function r2KeyForUrl(fileUrl: string): string | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !bucket) return null;
  // Same public-base rule as src/lib/integrations/r2.ts.
  const base = (process.env.R2_PUBLIC_BASE_URL ?? `https://${accountId}.r2.cloudflarestorage.com/${bucket}`).replace(
    /\/+$/,
    "",
  );
  if (!fileUrl.startsWith(`${base}/`)) return null;
  const key = decodeURIComponent(fileUrl.slice(base.length + 1).split(/[?#]/)[0]);
  return key && !key.includes("..") ? key : null;
}

/**
 * Index one uploaded material under its class. Never throws for "can't be
 * indexed" cases — those come back as status "skipped" with a reason.
 */
export async function ingestMaterial(
  materialId: string,
  options: { force?: boolean } = {},
): Promise<IngestResult> {
  const skipped = (reason: string): IngestResult => ({ status: "skipped", chunksCreated: 0, totalTokens: 0, reason });

  if (!aiConfig.embeddings.configured) return skipped("embeddings not configured");

  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: { id: true, classId: true, title: true, fileUrl: true },
  });
  if (!material) return skipped("material not found");

  if (!isR2Configured()) return skipped("file storage not configured");
  const key = r2KeyForUrl(material.fileUrl);
  if (!key) return skipped("external link (only files uploaded to our storage are indexed)");

  const extFromKey = textKindFor(null, key);
  // Cheap early exit on extension so we don't download a 5 MB PDF for nothing.
  if (/\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|gif|webp|mp3|mp4|m4a|zip)$/i.test(key)) {
    return skipped(`unsupported file type (${key.slice(key.lastIndexOf(".") + 1)}); no text extractor yet`);
  }

  const signedUrl = await createPresignedDownloadUrl(key, 300);
  if (!signedUrl) return skipped("file storage not configured");

  const res = await fetch(signedUrl, { signal: AbortSignal.timeout(aiConfig.timeouts.embeddingMs) });
  if (!res.ok) return skipped(`download failed (${res.status})`);

  const declaredSize = Number(res.headers.get("content-length") ?? "0");
  if (declaredSize > MAX_MATERIAL_BYTES) return skipped("file too large");

  const kind = textKindFor(res.headers.get("content-type"), key) ?? extFromKey;
  if (!kind) return skipped(`unsupported content type (${res.headers.get("content-type") ?? "unknown"})`);

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_MATERIAL_BYTES) return skipped("file too large");
  const raw = new TextDecoder("utf-8").decode(buffer);
  const text = kind === "html" ? htmlToText(raw) : raw.trim();
  if (text.length < 10) return { status: "empty", chunksCreated: 0, totalTokens: 0 };

  return ingestDocument({
    content: text,
    sourceType: "MATERIAL",
    sourceId: material.id,
    sourceTitle: material.title,
    classId: material.classId,
    force: options.force,
  });
}

/**
 * Fire-and-forget material indexing for upload/edit routes. Returns
 * immediately; the outcome is logged. Call it AFTER the Material row is saved.
 */
export function scheduleMaterialIngest(materialId: string, options: { force?: boolean } = {}): void {
  void ingestMaterial(materialId, options)
    .then((result) => {
      const detail = result.reason ? ` — ${result.reason}` : "";
      console.log(`[AI ingest] material ${materialId}: ${result.status} (${result.chunksCreated} chunks)${detail}`);
    })
    .catch((err) => {
      console.error(`[AI ingest] material ${materialId} failed:`, (err as Error).message);
    });
}
