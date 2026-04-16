import { NextResponse } from "next/server";

import { aiConfig } from "@/lib/ai/config";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/security/session";
import { isSuperAdmin } from "@/lib/security/superadmin";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN" || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
