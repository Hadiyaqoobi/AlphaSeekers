/**
 * AI subsystem configuration.
 *
 * All AI features gracefully degrade when credentials are missing.
 * Follows the same pattern as the main runtime.ts configuration.
 *
 * Providers:
 *   LLM (primary):  Groq (OpenAI-compatible) — free tier: 14,400 req/day
 *   LLM (fallback): Google AI Studio (Gemma) — free tier: 10 RPM
 *   Embeddings:     HuggingFace Inference API — free tier: rate-limited
 *   Vector DB:      pgvector on PostgreSQL/Neon — free tier supports extension
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COST / SCALE REALITY (see needs_ops_action in the accompanying report):
 *
 * Every value below is env-driven so the deployment can point at ANY
 * provider/model/key and tune limits WITHOUT a code change. The defaults are
 * sized for the FREE tiers of Groq + Google AI Studio + HuggingFace, which are
 * fine for a pilot cohort but WILL rate-limit (429) under real classroom-scale
 * concurrent load. Production scale REQUIRES a paid AI tier (Groq paid plan,
 * Google AI paid, or self-hosted inference). Raising the free-tier ceiling
 * cannot be done in code — it is an operational/billing action. The per-user
 * quotas below are the code-side guard that keeps a single student from
 * exhausting the shared free-tier budget for the whole class.
 * ─────────────────────────────────────────────────────────────────────────
 */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw !== undefined ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function floatEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw !== undefined ? parseFloat(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const aiConfig = (() => {
  const groqApiKey = process.env.GROQ_API_KEY ?? "";
  const gemmaApiKey = process.env.GEMMA_API_KEY ?? "";
  const hfApiToken = process.env.HF_API_TOKEN ?? "";

  return {
    groq: {
      apiKey: groqApiKey,
      baseUrl: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
      configured: groqApiKey.length > 0,
    },
    gemma: {
      apiKey: gemmaApiKey,
      model: process.env.GEMMA_MODEL ?? "gemma-3-27b-it",
      configured: gemmaApiKey.length > 0,
    },
    embeddings: {
      apiToken: hfApiToken,
      model: process.env.HF_EMBEDDING_MODEL ?? "sentence-transformers/all-MiniLM-L6-v2",
      dimension: 384,
      configured: hfApiToken.length > 0,
    },
    rag: {
      chunkSize: intEnv("RAG_CHUNK_SIZE", 1500),
      chunkOverlap: intEnv("RAG_CHUNK_OVERLAP", 200),
      topK: intEnv("RAG_TOP_K", 5),
      similarityThreshold: floatEnv("RAG_SIMILARITY_THRESHOLD", 0.3),
    },
    /**
     * Generation limits — env-driven so paid tiers can raise them.
     */
    limits: {
      maxOutputTokens: intEnv("AI_MAX_OUTPUT_TOKENS", 1024),
    },
    /**
     * Network timeouts (ms). A single hung generation otherwise pins the CPU
     * on a serverless instance, so every provider fetch is bounded by these.
     */
    timeouts: {
      /** Non-streaming completion request. */
      completionMs: intEnv("AI_COMPLETION_TIMEOUT_MS", 45_000),
      /** Streaming completion — idle timeout, reset on each chunk received. */
      streamMs: intEnv("AI_STREAM_TIMEOUT_MS", 60_000),
      /** Vision (homework review) request. */
      visionMs: intEnv("AI_VISION_TIMEOUT_MS", 60_000),
      /** Embedding request. */
      embeddingMs: intEnv("AI_EMBEDDING_TIMEOUT_MS", 30_000),
    },
    /**
     * Per-user cost-safety quotas. These are the CODE-SIDE guard against one
     * student exhausting the shared provider quota / instance memory. They are
     * enforced via the distributed rate limiter (see rateLimits below) and are
     * intentionally conservative on the free tier. A paid tier can raise them
     * through env vars without a redeploy of logic.
     */
    quota: {
      /** Soft daily ceiling on AI requests per user (informational + docs). */
      dailyRequestsPerUser: intEnv("AI_DAILY_REQUESTS_PER_USER", 300),
      /** Soft daily ceiling on generated tokens per user. */
      dailyTokensPerUser: intEnv("AI_DAILY_TOKENS_PER_USER", 120_000),
    },
    /**
     * Per-route rate-limit windows, shaped as { limit, windowMs } so they can be
     * passed straight to checkRateLimitDistributed(key, config). Tuned per route:
     * "quick"/"ask" are chatty; "reviewHomework" (vision) is expensive; "ingest"
     * is admin-only bulk work.
     */
    rateLimits: {
      ask: { limit: intEnv("AI_RL_ASK_LIMIT", 40), windowMs: intEnv("AI_RL_ASK_WINDOW_MS", 5 * 60 * 1000) },
      quick: { limit: intEnv("AI_RL_QUICK_LIMIT", 30), windowMs: intEnv("AI_RL_QUICK_WINDOW_MS", 5 * 60 * 1000) },
      reviewHomework: {
        limit: intEnv("AI_RL_HOMEWORK_LIMIT", 15),
        windowMs: intEnv("AI_RL_HOMEWORK_WINDOW_MS", 10 * 60 * 1000),
      },
      ingest: { limit: intEnv("AI_RL_INGEST_LIMIT", 30), windowMs: intEnv("AI_RL_INGEST_WINDOW_MS", 60 * 1000) },
    },
    /**
     * Cache TTL (ms). Cached answers expire after this so a stale answer never
     * outlives the material it was derived from (re-ingestion also invalidates).
     */
    cache: {
      ttlMs: intEnv("AI_CACHE_TTL_MS", 7 * 24 * 60 * 60 * 1000),
    },
    get enabled() {
      return this.groq.configured && this.embeddings.configured;
    },
  };
})();

export function assertAiConfigured(): void {
  if (!aiConfig.enabled) {
    throw new Error(
      "AI features require GROQ_API_KEY and HF_API_TOKEN. " +
      "See .env.example for configuration.",
    );
  }
}
