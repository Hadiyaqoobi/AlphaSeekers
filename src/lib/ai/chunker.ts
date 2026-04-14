/**
 * Document chunker using recursive character splitting.
 *
 * Splits text into overlapping chunks optimized for retrieval:
 *   - Attempts to split on paragraph boundaries first
 *   - Falls back to sentence boundaries (English + Dari)
 *   - Falls back to word boundaries
 *   - Maintains overlap for context continuity
 */

import { aiConfig } from "./config";

export type DocumentChunkInput = {
  content: string;
  sourceType: "LIBRARY" | "MATERIAL";
  sourceId: string;
  sourceTitle: string;
};

export type ChunkedDocument = {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  sourceType: string;
  sourceId: string;
  sourceTitle: string;
};

// Ordered from most to least preferred split boundaries.
// Includes Dari period (۔) and comma (،) for RTL text.
const SEPARATORS = ["\n\n", "\n", ". ", "۔ ", "، ", ", ", " ", ""];

/**
 * Rough token count approximation.
 * English: ~4 characters/token. Dari/Arabic script: ~2 characters/token.
 */
function estimateTokenCount(text: string): number {
  const hasArabicScript = /[\u0600-\u06FF]/.test(text);
  return Math.ceil(text.length / (hasArabicScript ? 2 : 4));
}

function splitTextRecursive(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  separators: string[] = SEPARATORS,
): string[] {
  if (text.length <= chunkSize) {
    return [text.trim()].filter(Boolean);
  }

  const separator = separators.find((sep) => text.includes(sep)) ?? "";
  const parts = separator ? text.split(separator) : [text];

  const chunks: string[] = [];
  let currentChunk = "";

  for (const part of parts) {
    const candidate = currentChunk
      ? currentChunk + separator + part
      : part;

    if (candidate.length > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      // Keep overlap from end of current chunk for context continuity
      const overlapText = currentChunk.slice(-chunkOverlap);
      currentChunk = overlapText + separator + part;
    } else {
      currentChunk = candidate;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Recursively split any chunks that are still too large
  const result: string[] = [];
  const nextSeparators = separators.slice(separators.indexOf(separator) + 1);

  for (const chunk of chunks) {
    if (chunk.length > chunkSize && nextSeparators.length > 0) {
      result.push(...splitTextRecursive(chunk, chunkSize, chunkOverlap, nextSeparators));
    } else {
      result.push(chunk);
    }
  }

  return result;
}

/**
 * Split a document into overlapping chunks suitable for embedding and retrieval.
 */
export function chunkDocument(input: DocumentChunkInput): ChunkedDocument[] {
  const { chunkSize, chunkOverlap } = aiConfig.rag;

  const textChunks = splitTextRecursive(input.content, chunkSize, chunkOverlap);

  return textChunks.map((content, index) => ({
    content,
    chunkIndex: index,
    tokenCount: estimateTokenCount(content),
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceTitle: input.sourceTitle,
  }));
}
