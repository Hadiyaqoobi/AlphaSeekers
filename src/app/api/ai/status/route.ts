import { aiConfig } from "@/lib/ai/config";
import { getChunkStats, isVectorStoreReady } from "@/lib/ai/vector-store";
import { guardPermission } from "@/lib/security/api-guard";

/**
 * GET /api/ai/status
 *
 * Admin-only endpoint to inspect AI subsystem health.
 * Returns provider configuration, vector store statistics,
 * and RAG pipeline parameters.
 */
export async function GET() {
  const g = await guardPermission("ai.manage");
  if (!g.ok) return g.response;

  const vectorStoreReady = aiConfig.enabled
    ? await isVectorStoreReady().catch(() => false)
    : false;

  const vectorStats = aiConfig.enabled && vectorStoreReady
    ? await getChunkStats().catch(() => null)
    : null;

  return Response.json({
    enabled: aiConfig.enabled,
    vectorStoreReady,
    providers: {
      llm: {
        provider: "groq",
        model: aiConfig.groq.model,
        configured: aiConfig.groq.configured,
      },
      embeddings: {
        provider: "huggingface",
        model: aiConfig.embeddings.model,
        dimension: aiConfig.embeddings.dimension,
        configured: aiConfig.embeddings.configured,
      },
    },
    rag: {
      chunkSize: aiConfig.rag.chunkSize,
      chunkOverlap: aiConfig.rag.chunkOverlap,
      topK: aiConfig.rag.topK,
      similarityThreshold: aiConfig.rag.similarityThreshold,
    },
    vectorStore: vectorStats,
  });
}
