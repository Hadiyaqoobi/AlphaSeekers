/**
 * Multi-provider LLM client.
 *
 * Primary: Groq (Llama 3.1 8B) — free tier: 14,400 req/day
 * Fallback: Google AI Studio (Gemma 3 27B) — free tier: 10 RPM
 *
 * Automatic failover: if primary fails, fallback is tried transparently.
 * Both providers use raw fetch (no SDK dependency).
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

/**
 * Stream a completion via Google AI Studio (Gemma).
 * Converts OpenAI message format to Google's format and normalizes output.
 */
async function streamGemmaCompletion(
  messages: ChatMessage[],
  callbacks: LlmStreamCallbacks,
): Promise<void> {
  const { apiKey, model } = aiConfig.gemma;

  if (!apiKey) {
    callbacks.onError(new Error("GEMMA_API_KEY is required for Gemma fallback"));
    return;
  }

  // Convert OpenAI messages → Google format
  let systemInstruction: { parts: { text: string }[] } | undefined;
  const contents: { role: string; parts: { text: string }[] }[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction = { parts: [{ text: msg.content }] };
    } else {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(systemInstruction && { systemInstruction }),
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    callbacks.onError(new Error(`Gemma API error (${response.status}): ${errorText}`));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("No response body stream from Gemma"));
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
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            callbacks.onToken(text);
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    callbacks.onDone();
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Stream a completion with automatic provider fallback.
 *
 * Order: Groq (primary) → Gemma (fallback) → error message.
 * Returns which provider succeeded via the `onProvider` callback.
 */
export async function streamCompletionWithFallback(
  messages: ChatMessage[],
  callbacks: LlmStreamCallbacks & { onProvider?: (name: string) => void },
): Promise<void> {
  // Try Groq first
  if (aiConfig.groq.configured) {
    try {
      console.log("[AI] Trying Groq...");
      await streamCompletion(messages, callbacks);
      console.log("[AI] Groq success");
      callbacks.onProvider?.("groq");
      return;
    } catch (err) {
      console.warn("[AI] Groq failed:", (err as Error).message);
    }
  }

  // Try Gemma fallback
  if (aiConfig.gemma.configured) {
    try {
      console.log("[AI] Trying Gemma...");
      await streamGemmaCompletion(messages, callbacks);
      console.log("[AI] Gemma success");
      callbacks.onProvider?.("gemma");
      return;
    } catch (err) {
      console.error("[AI] Gemma failed:", (err as Error).message);
    }
  }

  // Both failed
  console.error("[AI] All providers failed");
  callbacks.onError(
    new Error("I'm having trouble connecting right now. Please try again in a moment."),
  );
}
