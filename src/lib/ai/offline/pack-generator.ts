/**
 * Offline study pack for one class.
 *
 * A JSON file a student can download over WiFi and read offline (e.g. during
 * internet shutdowns).
 *
 * PRIVACY: the previous version bundled the class's "top Q&A" — other
 * students' raw questions and the AI's answers to them, selected by a
 * classIds substring match that (because every interaction was tagged with ALL
 * of the asker's classes) also pulled in questions and material from OTHER
 * classes. The pack now contains only:
 *   - this class's own indexed material (materials + recording transcripts,
 *     DocumentChunk rows with classId = this class), and
 *   - the requesting student's OWN past questions answered from this class's
 *     material (never anyone else's).
 */

import { prisma } from "@/lib/prisma";

export interface AnswerPackItem {
  question: string;
  answer: string;
  sources: string[];
  topics: string[];
}

export interface AnswerPackMaterial {
  title: string;
  sourceType: string;
  /** Indexed passages in reading order (consecutive passages overlap slightly). */
  passages: string[];
}

export interface AnswerPack {
  classId: string;
  className: string;
  generatedAt: string;
  version: number;
  materials: AnswerPackMaterial[];
  /** The requesting student's own Q&A for this class (empty for staff). */
  items: AnswerPackItem[];
}

/** Bound the download: a pack is meant for a phone on a slow connection. */
const MAX_CHUNKS = 600;
const MAX_OWN_ITEMS = 50;

/**
 * Exact class membership of an AIInteraction.classIds CSV (a substring
 * `contains` match alone is not proof — this is the check).
 */
export function taggedWithClass(classIds: string | null, classId: string): boolean {
  return (classIds ?? "").split(",").some((c) => c.trim() === classId);
}

/** Group a class's chunks (any order) into per-source materials in reading order. */
export function groupChunksIntoMaterials(
  chunks: Array<{ sourceId: string; sourceTitle: string; sourceType: string; chunkIndex: number; content: string }>,
): AnswerPackMaterial[] {
  const bySource = new Map<string, { title: string; sourceType: string; parts: Array<[number, string]> }>();
  for (const c of chunks) {
    let entry = bySource.get(c.sourceId);
    if (!entry) {
      entry = { title: c.sourceTitle, sourceType: c.sourceType, parts: [] };
      bySource.set(c.sourceId, entry);
    }
    entry.parts.push([c.chunkIndex, c.content]);
  }
  return Array.from(bySource.values()).map((e) => ({
    title: e.title,
    sourceType: e.sourceType,
    passages: e.parts.sort((a, b) => a[0] - b[0]).map(([, text]) => text),
  }));
}

export async function generateAnswerPack(
  classId: string,
  requesterId: string | null,
): Promise<AnswerPack | null> {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true },
  });

  if (!cls) return null;

  const [chunks, ownInteractions] = await Promise.all([
    prisma.documentChunk.findMany({
      where: { classId },
      orderBy: [{ sourceId: "asc" }, { chunkIndex: "asc" }],
      take: MAX_CHUNKS,
      select: { sourceId: true, sourceTitle: true, sourceType: true, chunkIndex: true, content: true },
    }),
    requesterId
      ? prisma.aIInteraction.findMany({
          where: {
            userId: requesterId,
            classIds: { contains: classId },
            answer: { not: null },
            mode: { in: ["study", "explain"] },
          },
          orderBy: { createdAt: "desc" },
          take: MAX_OWN_ITEMS * 2,
          select: { query: true, answer: true, sources: true, topics: true, classIds: true },
        })
      : Promise.resolve([]),
  ]);

  const items: AnswerPackItem[] = ownInteractions
    .filter((i) => taggedWithClass(i.classIds, classId) && i.answer && i.answer.length > 50)
    .slice(0, MAX_OWN_ITEMS)
    .map((i) => {
      let sourceTitles: string[] = [];
      if (i.sources) {
        try {
          const parsed = JSON.parse(i.sources);
          if (Array.isArray(parsed)) {
            sourceTitles = parsed.map((s: { title?: string }) => s.title || "").filter(Boolean);
          }
        } catch {
          // ignore malformed sources
        }
      }
      return {
        question: i.query,
        answer: i.answer || "",
        sources: sourceTitles,
        topics: i.topics ? i.topics.split(",").filter(Boolean) : [],
      };
    });

  return {
    classId,
    className: cls.name,
    generatedAt: new Date().toISOString(),
    version: 2,
    materials: groupChunksIntoMaterials(chunks),
    items,
  };
}
