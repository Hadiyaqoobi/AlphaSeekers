/**
 * AI subsystem configuration.
 *
 * All AI features gracefully degrade when credentials are missing.
 * Follows the same pattern as the main runtime.ts configuration.
 *
 * Providers:
 *   LLM:        Groq (OpenAI-compatible) — free tier: 14,400 req/day
 *   Embeddings: HuggingFace Inference API — free tier: rate-limited
 *   Vector DB:  pgvector on PostgreSQL/Neon — free tier supports extension
 */

export const aiConfig = (() => {
  const groqApiKey = process.env.GROQ_API_KEY ?? "";
  const hfApiToken = process.env.HF_API_TOKEN ?? "";

  return {
    groq: {
      apiKey: groqApiKey,
      baseUrl: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
      configured: groqApiKey.length > 0,
    },
    embeddings: {
      apiToken: hfApiToken,
      model: process.env.HF_EMBEDDING_MODEL ?? "sentence-transformers/all-MiniLM-L6-v2",
      dimension: 384,
      configured: hfApiToken.length > 0,
    },
    rag: {
      chunkSize: parseInt(process.env.RAG_CHUNK_SIZE ?? "1500", 10),
      chunkOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP ?? "200", 10),
      topK: parseInt(process.env.RAG_TOP_K ?? "5", 10),
      similarityThreshold: parseFloat(process.env.RAG_SIMILARITY_THRESHOLD ?? "0.3"),
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
