/**
 * Embedding generation via HuggingFace Inference API.
 *
 * Model: aiConfig.embeddings.model (default the multilingual
 * paraphrase-multilingual-MiniLM-L12-v2, 384 dimensions — must stay 384 to
 * match the vector column). Free tier: rate-limited.
 *
 * Every request is bounded by aiConfig.timeouts.embeddingMs. A 4xx other than
 * 408/429 (bad token, unknown model, bad input) will fail the same way on every
 * retry, so it is not retried.
 *
 * No SDK dependency — uses fetch directly for provider portability.
 */

import { NonRetryableError, retryWithBackoff } from "@/lib/retry";

import { aiConfig } from "./config";

const HF_INFERENCE_URL = "https://router.huggingface.co/hf-inference/models";

/** Status codes worth retrying: timeouts, rate limits, and server errors. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Generate an embedding vector for a single text input.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { apiToken, model, dimension } = aiConfig.embeddings;

  if (!apiToken) {
    throw new Error("HF_API_TOKEN is required for embedding generation");
  }

  const response = await retryWithBackoff(async () => {
    const res = await fetch(`${HF_INFERENCE_URL}/${model}/pipeline/feature-extraction`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: text,
        options: { wait_for_model: true },
      }),
      // Fresh signal per attempt, so a retry gets its own full time budget.
      signal: AbortSignal.timeout(aiConfig.timeouts.embeddingMs),
    });

    if (!res.ok) {
      const errorText = (await res.text().catch(() => "")).slice(0, 300);
      const message = `HuggingFace API error (${res.status}): ${errorText}`;
      if (!isRetryableStatus(res.status)) throw new NonRetryableError(message);
      throw new Error(message);
    }

    return res.json();
  });

  // HF returns nested array for single input: [[0.1, 0.2, ...]]
  const embedding: number[] = Array.isArray(response[0]) ? response[0] : response;

  if (!Array.isArray(embedding) || embedding.length !== dimension) {
    throw new Error(
      `Unexpected embedding dimension: got ${Array.isArray(embedding) ? embedding.length : "non-array"}, ` +
      `expected ${dimension}`,
    );
  }

  return embedding;
}

/**
 * Generate embeddings for multiple texts.
 * Batches requests to respect HuggingFace free tier rate limits.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 8;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(generateEmbedding));
    results.push(...batchResults);
  }

  return results;
}
