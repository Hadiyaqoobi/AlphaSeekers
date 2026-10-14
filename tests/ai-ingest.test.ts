/**
 * Retrieval plumbing: chunk sizes, the unchanged-content skip, what material
 * files can be read, embedding timeouts/retries, Whisper file naming, and the
 * answer-pack scoping. Database and network are mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  documentChunk: { findMany: vi.fn() },
  aIInteraction: { findMany: vi.fn() },
  class: { findUnique: vi.fn() },
  cachedResponse: { updateMany: vi.fn(async () => ({ count: 0 })) },
  $executeRawUnsafe: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const embed = vi.hoisted(() => ({ generateEmbeddings: vi.fn() }));
vi.mock("@/lib/ai/embeddings", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/embeddings")>()),
  generateEmbeddings: embed.generateEmbeddings,
}));

import { chunkDocument } from "@/lib/ai/chunker";
import { aiConfig } from "@/lib/ai/config";
import { chunksUnchanged, htmlToText, ingestDocument, r2KeyForUrl, textKindFor } from "@/lib/ai/ingest";
import { generateAnswerPack, groupChunksIntoMaterials, taggedWithClass } from "@/lib/ai/offline/pack-generator";
import { answeringClassIds } from "@/lib/ai/rag-pipeline";
import { whisperFilename } from "@/lib/ai/session/recording-processor";

function paragraphText(n: number): string {
  return Array.from({ length: n }, (_, i) => `Sentence number ${i} talks about grammar and verbs.`).join(" ");
}

describe("chunker sizing", () => {
  it("defaults to ~600-char chunks with 200 overlap (fits the embedding window)", () => {
    expect(aiConfig.rag.chunkSize).toBe(600);
    expect(aiConfig.rag.chunkOverlap).toBe(200);
  });

  it("never emits a chunk longer than the chunk size", () => {
    const chunks = chunkDocument({
      content: paragraphText(200),
      sourceType: "MATERIAL",
      sourceId: "m1",
      sourceTitle: "Grammar",
    });
    expect(chunks.length).toBeGreaterThan(5);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(aiConfig.rag.chunkSize);
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
  });

  it("overlaps consecutive chunks so text near a boundary is in two chunks", () => {
    const chunks = chunkDocument({ content: paragraphText(60), sourceType: "MATERIAL", sourceId: "m", sourceTitle: "t" });
    const tail = chunks[0].content.slice(-60);
    expect(chunks[1].content).toContain(tail.slice(tail.indexOf(" ") + 1));
  });

  it("keeps a short document as one chunk", () => {
    const chunks = chunkDocument({ content: "Short note.", sourceType: "LIBRARY", sourceId: "s", sourceTitle: "t" });
    expect(chunks).toHaveLength(1);
  });
});

describe("ingestDocument skips unchanged content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call the embedding API when the stored chunks already match", async () => {
    const input = { content: paragraphText(30), sourceType: "MATERIAL" as const, sourceId: "m1", sourceTitle: "T" };
    const chunks = chunkDocument(input);
    db.documentChunk.findMany.mockResolvedValueOnce(
      chunks.map((c) => ({ content: c.content, sourceTitle: "T", classId: "class1" })),
    );

    const result = await ingestDocument({ ...input, classId: "class1" });

    expect(result.status).toBe("unchanged");
    expect(embed.generateEmbeddings).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("re-embeds when the class changed even if the text did not", () => {
    const next = [{ content: "a", sourceTitle: "T" }];
    expect(chunksUnchanged([{ content: "a", sourceTitle: "T", classId: "c1" }], next, "c1")).toBe(true);
    expect(chunksUnchanged([{ content: "a", sourceTitle: "T", classId: "c1" }], next, "c2")).toBe(false);
    expect(chunksUnchanged([{ content: "a", sourceTitle: "Old", classId: "c1" }], next, "c1")).toBe(false);
    expect(chunksUnchanged([], next, "c1")).toBe(false);
  });
});

describe("material text extraction", () => {
  it("reads text, markdown and html; refuses pdf/docx", () => {
    expect(textKindFor("text/plain; charset=utf-8", "x")).toBe("text");
    expect(textKindFor("text/markdown", "x")).toBe("text");
    expect(textKindFor("text/html", "x")).toBe("html");
    expect(textKindFor("application/octet-stream", "materials/c/1-notes.md")).toBe("text");
    expect(textKindFor("application/pdf", "a.pdf")).toBeNull();
    expect(textKindFor(null, "lesson.docx")).toBeNull();
  });

  it("turns html into plain text and drops scripts", () => {
    const text = htmlToText("<h1>Verbs</h1><script>alert(1)</script><p>Run &amp; jump &lt;fast&gt;</p>");
    expect(text).toContain("Verbs");
    expect(text).toContain("Run & jump <fast>");
    expect(text).not.toContain("alert");
  });

  describe("r2KeyForUrl only accepts our own bucket", () => {
    const saved = { ...process.env };
    beforeEach(() => {
      process.env.R2_ACCOUNT_ID = "acc";
      process.env.R2_BUCKET = "bkt";
      process.env.R2_PUBLIC_BASE_URL = "https://files.example.org/";
    });
    afterEach(() => {
      process.env = { ...saved };
    });

    it("maps our public URL to its key", () => {
      expect(r2KeyForUrl("https://files.example.org/materials/c1/123-notes.txt")).toBe("materials/c1/123-notes.txt");
    });
    it("rejects external links and lookalike hosts", () => {
      expect(r2KeyForUrl("https://drive.google.com/file/d/abc")).toBeNull();
      expect(r2KeyForUrl("https://files.example.org.evil.com/materials/x.txt")).toBeNull();
      expect(r2KeyForUrl("https://files.example.org/../secret")).toBeNull();
    });
  });
});

describe("embedding requests", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    vi.resetModules();
    process.env.HF_API_TOKEN = "hf-test";
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
  });

  it("does not retry a 4xx and passes an abort signal", async () => {
    const fetchMock = vi.fn(async () => new Response("bad model", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const { generateEmbedding } = await vi.importActual<typeof import("@/lib/ai/embeddings")>("@/lib/ai/embeddings");

    await expect(generateEmbedding("hello")).rejects.toThrow(/400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].signal).toBeInstanceOf(AbortSignal);
  });

  it("uses the multilingual 384-dim model by default", async () => {
    const vec = Array.from({ length: 384 }, () => 0.1);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([vec]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { generateEmbedding } = await vi.importActual<typeof import("@/lib/ai/embeddings")>("@/lib/ai/embeddings");

    await expect(generateEmbedding("hello")).resolves.toHaveLength(384);
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain(
      "paraphrase-multilingual-MiniLM-L12-v2",
    );
  });
});

describe("Whisper file name", () => {
  it("uses a real audio extension (Whisper picks the decoder from it)", () => {
    expect(whisperFilename("audio/mpeg", "class.mp3")).toBe("recording.mp3");
    expect(whisperFilename("audio/x-m4a", "voice memo")).toBe("recording.m4a");
    expect(whisperFilename("audio/webm;codecs=opus", null)).toBe("recording.webm");
    expect(whisperFilename("", "lecture.WAV")).toBe("recording.wav");
    expect(whisperFilename("application/octet-stream", "x.bin")).toBe("recording.mp3");
  });
});

describe("answer-pack scoping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tags an interaction only with the classes whose material answered", () => {
    expect(answeringClassIds([{ classId: "A" }, { classId: null }, { classId: "A" }, { classId: "B" }])).toEqual([
      "A",
      "B",
    ]);
    expect(answeringClassIds([{ classId: null }])).toEqual([]);
  });

  it("checks exact class membership, not substrings", () => {
    expect(taggedWithClass("abc,def", "abc")).toBe(true);
    expect(taggedWithClass("xabcx", "abc")).toBe(false);
    expect(taggedWithClass(null, "abc")).toBe(false);
  });

  it("groups chunks per source in reading order", () => {
    const out = groupChunksIntoMaterials([
      { sourceId: "s1", sourceTitle: "One", sourceType: "MATERIAL", chunkIndex: 1, content: "b" },
      { sourceId: "s1", sourceTitle: "One", sourceType: "MATERIAL", chunkIndex: 0, content: "a" },
      { sourceId: "s2", sourceTitle: "Two", sourceType: "RECORDING", chunkIndex: 0, content: "c" },
    ]);
    expect(out).toEqual([
      { title: "One", sourceType: "MATERIAL", passages: ["a", "b"] },
      { title: "Two", sourceType: "RECORDING", passages: ["c"] },
    ]);
  });

  it("reads only this class's chunks and only the requester's own questions", async () => {
    db.class.findUnique.mockResolvedValueOnce({ name: "English A2" });
    db.documentChunk.findMany.mockResolvedValueOnce([]);
    db.aIInteraction.findMany.mockResolvedValueOnce([
      { query: "mine", answer: "x".repeat(60), sources: null, topics: null, classIds: "classA" },
      { query: "substring hit", answer: "x".repeat(60), sources: null, topics: null, classIds: "classAB" },
    ]);

    const pack = await generateAnswerPack("classA", "student1");

    expect(db.documentChunk.findMany.mock.calls[0][0].where).toEqual({ classId: "classA" });
    expect(db.aIInteraction.findMany.mock.calls[0][0].where).toMatchObject({ userId: "student1" });
    expect(pack?.items.map((i) => i.question)).toEqual(["mine"]);
    expect(pack?.version).toBe(2);
  });

  it("gives staff the material only — no one's questions", async () => {
    db.class.findUnique.mockResolvedValueOnce({ name: "English A2" });
    db.documentChunk.findMany.mockResolvedValueOnce([]);

    const pack = await generateAnswerPack("classA", null);

    expect(db.aIInteraction.findMany).not.toHaveBeenCalled();
    expect(pack?.items).toEqual([]);
  });
});
