import { NextResponse } from "next/server";

import { aiConfig } from "@/lib/ai/config";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/security/api-guard";

export async function GET() {
  const g = await guardPermission("ai.manage");
  if (!g.ok) return g.response;

  const [cacheTotal, cacheHits, cacheAvgQuality] = await Promise.all([
    prisma.cachedResponse.count().catch(() => 0),
    prisma.cachedResponse
      .aggregate({ _sum: { hitCount: true } })
      .then((r) => r._sum.hitCount ?? 0)
      .catch(() => 0),
    prisma.cachedResponse
      .aggregate({ _avg: { quality: true } })
      .then((r) => r._avg.quality)
      .catch(() => null),
  ]);

  return NextResponse.json({
    providers: {
      groq: {
        configured: aiConfig.groq.configured,
        model: aiConfig.groq.model,
      },
      gemma: {
        configured: aiConfig.gemma.configured,
        model: aiConfig.gemma.model,
      },
      embeddings: {
        configured: aiConfig.embeddings.configured,
        model: aiConfig.embeddings.model,
        dimension: aiConfig.embeddings.dimension,
      },
    },
    cache: {
      totalEntries: cacheTotal,
      totalHits: cacheHits,
      avgQuality: cacheAvgQuality,
    },
    rag: aiConfig.rag,
  });
}
