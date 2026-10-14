import { z } from "zod";

import { aiConfig } from "@/lib/ai/config";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { ingestDocument, ingestMaterial } from "@/lib/ai/ingest";
import { invalidateCache } from "@/lib/ai/response-cache";
import { reembedAllChunks } from "@/lib/ai/vector-store";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/security/api-guard";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import { badRequest } from "@/lib/security/session";

const documentSchema = z.object({
  sourceType: z.enum(["LIBRARY", "MATERIAL"]),
  sourceId: z.string().min(1),
  sourceTitle: z.string().min(1),
  content: z.string().min(10),
  classId: z.string().optional(), // Links document chunks to a specific class
  force: z.boolean().optional(),
});

const materialSchema = z.object({
  materialId: z.string().min(1),
  force: z.boolean().optional(),
});

const actionSchema = z.object({
  // reembed: recompute every stored vector with the current embedding model
  //          (run once after changing HF_EMBEDDING_MODEL).
  // reindex-materials: (re)index every uploaded material file.
  action: z.enum(["reembed", "reindex-materials"]),
});

// One maintenance job at a time per server process; a second click while one
// runs is refused instead of doubling the embedding traffic.
let maintenanceRunning: string | null = null;

function runMaintenance(name: string, job: () => Promise<unknown>): void {
  maintenanceRunning = name;
  void job()
    .then((result) => console.log(`[AI ingest] ${name} finished:`, JSON.stringify(result)))
    .catch((err) => console.error(`[AI ingest] ${name} failed:`, (err as Error).message))
    .finally(() => {
      maintenanceRunning = null;
    });
}

/**
 * POST /api/ai/ingest  (ai.manage)
 *
 * Body, one of:
 *   { sourceType, sourceId, sourceTitle, content, classId?, force? }  index raw text
 *   { materialId, force? }                                           index one uploaded material
 *   { action: "reembed" | "reindex-materials" }                      background maintenance (202)
 *
 * Re-ingesting a source replaces its chunks; unchanged text is skipped unless
 * `force` is set. Material uploads index themselves via scheduleMaterialIngest.
 */
export async function POST(request: Request) {
  const g = await guardPermission("ai.manage");
  if (!g.ok) return g.response;

  if (!aiConfig.enabled) {
    return Response.json(
      { message: "AI features are not configured. Set an LLM key and HF_API_TOKEN." },
      { status: 503 },
    );
  }

  const rl = await checkRateLimitDistributed(`ai-ingest:${g.access.userId}`, aiConfig.rateLimits.ingest);
  if (!rl.allowed) {
    return Response.json({ message: "Too many ingest requests. Please wait a minute." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);

  const action = actionSchema.safeParse(body);
  if (action.success) {
    if (maintenanceRunning) {
      return Response.json({ message: `Already running: ${maintenanceRunning}` }, { status: 409 });
    }
    if (action.data.action === "reembed") {
      runMaintenance("reembed", async () => {
        const result = await reembedAllChunks(generateEmbeddings);
        await invalidateCache().catch(() => {});
        return result;
      });
    } else {
      runMaintenance("reindex-materials", async () => {
        const materials = await prisma.material.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } });
        const counts: Record<string, number> = {};
        for (const m of materials) {
          const r = await ingestMaterial(m.id, { force: true }).catch(() => null);
          const status = r?.status ?? "failed";
          counts[status] = (counts[status] ?? 0) + 1;
        }
        return counts;
      });
    }
    return Response.json({ message: `Started ${action.data.action}. Progress is in the server log.` }, { status: 202 });
  }

  try {
    const material = materialSchema.safeParse(body);
    if (material.success) {
      const result = await ingestMaterial(material.data.materialId, { force: material.data.force });
      return Response.json({ materialId: material.data.materialId, ...result });
    }

    const parsed = documentSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(
        "Invalid input. Send { sourceType, sourceId, sourceTitle, content }, { materialId }, or { action }.",
      );
    }

    const { sourceType, sourceId, sourceTitle, content, classId, force } = parsed.data;
    const result = await ingestDocument({
      content,
      sourceType,
      sourceId,
      sourceTitle,
      classId: classId || null,
      force,
    });

    return Response.json({
      message:
        result.status === "unchanged"
          ? "Content unchanged; nothing re-embedded."
          : result.status === "empty"
            ? "No chunks generated from content."
            : "Document ingested successfully.",
      sourceId,
      sourceTitle,
      ...result,
    });
  } catch (error) {
    console.error("[AI] Ingestion failed:", error);
    return Response.json({ message: "Failed to ingest document." }, { status: 500 });
  }
}
