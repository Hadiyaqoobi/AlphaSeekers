/**
 * LLM client for Groq API (OpenAI-compatible).
 *
 * Uses Llama 3.1 8B via Groq's free tier (14,400 req/day).
 * Supports both streaming and non-streaming responses.
 *
 * Provider-agnostic: swap to any OpenAI-compatible endpoint
 * (OpenAI, Together, Ollama, Azure) by changing GROQ_BASE_URL.
 *
 * No SDK dependency — uses fetch directly.
 */

import { aiConfig } from "./config";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmStreamCallbacks = {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
};

/**
 * Generate a non-streaming completion.
 */
export async function generateCompletion(messages: ChatMessage[]): Promise<string> {
  const { apiKey, baseUrl, model } = aiConfig.groq;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required for LLM inference");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 1024,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Stream a completion, emitting tokens as they arrive.
 * Uses Server-Sent Events format from the Groq/OpenAI streaming API.
 */
export async function streamCompletion(
  messages: ChatMessage[],
  callbacks: LlmStreamCallbacks,
): Promise<void> {
  const { apiKey, baseUrl, model } = aiConfig.groq;

  if (!apiKey) {
    callbacks.onError(new Error("GROQ_API_KEY is required for LLM inference"));
    return;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    callbacks.onError(new Error(`Groq API error (${response.status}): ${errorText}`));
    return;
  }

  const reader = response.body?.getReader();

  if (!reader) {
    callbacks.onError(new Error("No response body stream"));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          callbacks.onDone();
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            callbacks.onToken(delta);
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    callbacks.onDone();
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}
