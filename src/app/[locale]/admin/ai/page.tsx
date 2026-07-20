import { redirect } from "next/navigation";

import { aiConfig } from "@/lib/ai/config";
import { prisma } from "@/lib/prisma";
import { getAccessControl, isSuper } from "@/lib/security/permissions";

type Props = { params: { locale: string } };

export default async function AdminAIPage({ params }: Props) {
  const locale = params.locale;
  const access = await getAccessControl();
  if (!access) redirect(`/${locale}/login`);
  // Superadmin-only: AI Health exposes provider configs and internal stats
  if (!isSuper(access)) redirect(`/${locale}/dashboard`);

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

  const providers = [
    { name: "Groq", model: aiConfig.groq.model, configured: aiConfig.groq.configured, role: "Primary LLM" },
    { name: "Gemma", model: aiConfig.gemma.model, configured: aiConfig.gemma.configured, role: "Fallback LLM" },
    { name: "HuggingFace", model: aiConfig.embeddings.model, configured: aiConfig.embeddings.configured, role: "Embeddings" },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-neon-400">Admin</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-main">AI System Health</h1>
      </header>

      {/* Provider Cards */}
      <div className="grid gap-5 sm:grid-cols-3 mb-10">
        {providers.map((p) => (
          <div key={p.name} className="rounded-2xl border border-white/5 bg-dark-100 p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className={`h-3 w-3 rounded-full ${p.configured ? "bg-neon-500" : "bg-red-400"}`} />
              <h3 className="text-lg font-bold text-ink-main">{p.name}</h3>
            </div>
            <p className="text-sm text-ink-soft">{p.role}</p>
            <p className="text-xs text-ink-faint mt-1 font-mono">{p.model}</p>
            <p className={`mt-3 text-sm font-semibold ${p.configured ? "text-neon-400" : "text-red-300"}`}>
              {p.configured ? "Configured" : "Not configured"}
            </p>
          </div>
        ))}
      </div>

      {/* Cache Stats */}
      <div className="rounded-2xl border border-white/5 bg-dark-100 p-6">
        <h2 className="text-lg font-bold text-ink-main mb-6">Response Cache</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <p className="text-sm text-ink-soft">Cached Responses</p>
            <p className="text-3xl font-bold text-ink-main mt-1">{cacheTotal}</p>
          </div>
          <div>
            <p className="text-sm text-ink-soft">Total Cache Hits</p>
            <p className="text-3xl font-bold text-ink-main mt-1">{cacheHits}</p>
          </div>
          <div>
            <p className="text-sm text-ink-soft">Avg Quality Score</p>
            <p className="text-3xl font-bold text-ink-main mt-1">
              {cacheAvgQuality != null ? `${(cacheAvgQuality * 100).toFixed(0)}%` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* RAG Config */}
      <div className="mt-5 rounded-2xl border border-white/5 bg-dark-100 p-6">
        <h2 className="text-lg font-bold text-ink-main mb-4">RAG Configuration</h2>
        <div className="grid gap-4 sm:grid-cols-4 text-sm">
          <div><span className="text-ink-faint">Chunk Size</span><p className="font-mono font-bold text-ink-main">{aiConfig.rag.chunkSize}</p></div>
          <div><span className="text-ink-faint">Chunk Overlap</span><p className="font-mono font-bold text-ink-main">{aiConfig.rag.chunkOverlap}</p></div>
          <div><span className="text-ink-faint">Top K</span><p className="font-mono font-bold text-ink-main">{aiConfig.rag.topK}</p></div>
          <div><span className="text-ink-faint">Similarity Threshold</span><p className="font-mono font-bold text-ink-main">{aiConfig.rag.similarityThreshold}</p></div>
        </div>
      </div>
    </section>
  );
}
