/**
 * Embedding generation via HuggingFace Inference API.
 *
 * Uses sentence-transformers/all-MiniLM-L6-v2 (384 dimensions).
 * Free tier: rate-limited but sufficient for educational platform usage.
 *
 * No SDK dependency — uses fetch directly for provider portability.
 */

import { retryWithBackoff } from "@/lib/retry";

import { aiConfig } from "./config";

const HF_INFERENCE_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction";

/**
 * Generate an embedding vector for a single text input.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { apiToken, model, dimension } = aiConfig.embeddings;

  if (!apiToken) {
    throw new Error("HF_API_TOKEN is required for embedding generation");
  }

  const response = await retryWithBackoff(async () => {
    const res = await fetch(`${HF_INFERENCE_URL}/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: text,
        options: { wait_for_model: true },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HuggingFace API error (${res.status}): ${errorText}`);
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
