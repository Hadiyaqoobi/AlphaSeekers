/**
 * Multi-provider LLM client.
 *
 * Primary: Groq (Llama 3.1 8B) — free tier: 14,400 req/day
 * Fallback: Google AI Studio (Gemma 3 27B) — free tier: 10 RPM
 *
 * Automatic failover: if the primary returns a non-OK HTTP status (429/5xx —
 * the exact scale failure mode), times out, or throws a network error, the
 * fallback provider is tried transparently. If all providers fail, the caller
 * gets a clean, generic error (LlmUnavailableError) — raw upstream error text
 * is logged server-side but NEVER surfaced to students.
 *
 * Every provider fetch is bounded by an AbortController timeout so a single
 * hung generation cannot pin the CPU on a serverless instance.
 *
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

/** Generic, user-safe message shown when every provider is exhausted. */
const GENERIC_UNAVAILABLE =
  "The AI service is temporarily unavailable. Please try again in a moment.";

/**
 * Thrown when all configured providers fail. Carries ONLY a generic,
 * user-facing message — callers can surface `.message` directly (e.g. as a
 * 503) without leaking upstream provider details.
 */
export class LlmUnavailableError extends Error {
  readonly statusCode = 503;
  constructor(message: string = GENERIC_UNAVAILABLE) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

export function isLlmUnavailable(err: unknown): err is LlmUnavailableError {
  return err instanceof LlmUnavailableError;
}

function cleanMsg(err: unknown): string {
  if (err instanceof Error) {
    return err.name === "AbortError" ? "timeout" : err.message;
  }
  return String(err);
}

/**
 * fetch() bounded by an AbortController timeout. Aborts (and rejects with an
 * AbortError) if the response headers don't arrive within `timeoutMs`.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Convert OpenAI-style messages to Google's generateContent format.
 * The last (or only) system message becomes systemInstruction.
 */
function toGoogleFormat(messages: ChatMessage[]): {
  systemInstruction?: { parts: { text: string }[] };
  contents: { role: string; parts: { text: string }[] }[];
} {
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

  return { systemInstruction, contents };
}

// ── Non-streaming providers ────────────────────────────────────────────────

async function generateGroq(messages: ChatMessage[]): Promise<string> {
  const { apiKey, baseUrl, model } = aiConfig.groq;

  const response = await fetchWithTimeout(
    `${baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: aiConfig.limits.maxOutputTokens,
        stream: false,
      }),
    },
    aiConfig.timeouts.completionMs,
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`[AI] Groq HTTP ${response.status}:`, errorText.slice(0, 500));
    throw new Error(`groq_http_${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function generateGemma(messages: ChatMessage[]): Promise<string> {
  const { apiKey, model } = aiConfig.gemma;
  const { systemInstruction, contents } = toGoogleFormat(messages);

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(systemInstruction && { systemInstruction }),
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: aiConfig.limits.maxOutputTokens,
        },
      }),
    },
    aiConfig.timeouts.completionMs,
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`[AI] Gemma HTTP ${response.status}:`, errorText.slice(0, 500));
    throw new Error(`gemma_http_${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/**
 * Generate a non-streaming completion with automatic Groq → Gemma failover.
 *
 * Throws LlmUnavailableError (generic, safe message) if every configured
 * provider fails. Never throws raw upstream error text.
 */
export async function generateCompletion(messages: ChatMessage[]): Promise<string> {
  if (!aiConfig.groq.configured && !aiConfig.gemma.configured) {
    throw new Error("GROQ_API_KEY is required for LLM inference");
  }

  const failures: string[] = [];

  if (aiConfig.groq.configured) {
    try {
      return await generateGroq(messages);
    } catch (err) {
      failures.push(`groq: ${cleanMsg(err)}`);
      console.warn("[AI] Groq completion failed, trying fallback:", cleanMsg(err));
    }
  }

  if (aiConfig.gemma.configured) {
    try {
      return await generateGemma(messages);
    } catch (err) {
      failures.push(`gemma: ${cleanMsg(err)}`);
      console.error("[AI] Gemma completion failed:", cleanMsg(err));
    }
  }

  console.error("[AI] All completion providers failed:", failures.join(" | "));
  throw new LlmUnavailableError();
}

// ── Streaming providers (internal — throw on failure so failover works) ─────

/**
 * Internal Groq streamer. Emits tokens via `onToken` and RESOLVES on success.
 * THROWS on any failure (non-OK status, network error, timeout) BEFORE the
 * caller has committed to this provider — this is what lets the orchestrator
 * fail over. Bounded by an idle timeout that aborts a hung stream.
 */
async function streamGroqInternal(
  messages: ChatMessage[],
  onToken: (token: string) => void,
): Promise<void> {
  const { apiKey, baseUrl, model } = aiConfig.groq;

  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), aiConfig.timeouts.streamMs);
  const resetTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), aiConfig.timeouts.streamMs);
  };

  try {
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
        max_tokens: aiConfig.limits.maxOutputTokens,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[AI] Groq stream HTTP ${response.status}:`, errorText.slice(0, 500));
      throw new Error(`groq_http_${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("groq_no_stream");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetTimer();

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) onToken(delta);
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Internal Gemma streamer via Google AI Studio. Same contract as
 * streamGroqInternal: resolves on success, throws on failure, bounded timeout.
 */
async function streamGemmaInternal(
  messages: ChatMessage[],
  onToken: (token: string) => void,
): Promise<void> {
  const { apiKey, model } = aiConfig.gemma;
  const { systemInstruction, contents } = toGoogleFormat(messages);

  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), aiConfig.timeouts.streamMs);
  const resetTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), aiConfig.timeouts.streamMs);
  };

  try {
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
            maxOutputTokens: aiConfig.limits.maxOutputTokens,
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[AI] Gemma stream HTTP ${response.status}:`, errorText.slice(0, 500));
      throw new Error(`gemma_http_${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("gemma_no_stream");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetTimer();

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
          if (text) onToken(text);
        } catch {
          // Skip malformed lines
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Stream a completion from Groq only, emitting tokens as they arrive.
 * Preserved for backward compatibility with any direct caller — routes errors
 * to `callbacks.onError` (does not throw). Prefer streamCompletionWithFallback.
 */
export async function streamCompletion(
  messages: ChatMessage[],
  callbacks: LlmStreamCallbacks,
): Promise<void> {
  if (!aiConfig.groq.configured) {
    callbacks.onError(new Error("GROQ_API_KEY is required for LLM inference"));
    return;
  }

  try {
    await streamGroqInternal(messages, callbacks.onToken);
    callbacks.onDone();
  } catch (err) {
    console.error("[AI] Groq stream failed:", cleanMsg(err));
    callbacks.onError(new LlmUnavailableError());
  }
}

/**
 * Stream a completion with automatic provider fallback.
 *
 * Order: Groq (primary) → Gemma (fallback) → clean error.
 *
 * Failover triggers on non-OK HTTP (429/5xx), network errors, AND timeouts —
 * as long as the failing provider has not yet emitted any token to the client.
 * Once tokens have streamed we cannot cleanly switch providers mid-response, so
 * a late failure surfaces a generic error instead. Reports the winning provider
 * via `onProvider`; never leaks raw upstream error text to the caller.
 */
export async function streamCompletionWithFallback(
  messages: ChatMessage[],
  callbacks: LlmStreamCallbacks & { onProvider?: (name: string) => void },
): Promise<void> {
  const providers: Array<{ name: string; configured: boolean; run: (onToken: (t: string) => void) => Promise<void> }> = [
    { name: "groq", configured: aiConfig.groq.configured, run: (onToken) => streamGroqInternal(messages, onToken) },
    { name: "gemma", configured: aiConfig.gemma.configured, run: (onToken) => streamGemmaInternal(messages, onToken) },
  ];

  for (const provider of providers) {
    if (!provider.configured) continue;

    let emitted = false;
    try {
      console.log(`[AI] Trying ${provider.name}...`);
      await provider.run((token) => {
        emitted = true;
        callbacks.onToken(token);
      });
      console.log(`[AI] ${provider.name} success`);
      callbacks.onProvider?.(provider.name);
      callbacks.onDone();
      return;
    } catch (err) {
      console.warn(`[AI] ${provider.name} failed:`, cleanMsg(err));
      if (emitted) {
        // Tokens already reached the client — a clean failover is impossible.
        console.error(`[AI] ${provider.name} failed mid-stream after emitting tokens`);
        callbacks.onError(new LlmUnavailableError());
        return;
      }
      // Nothing emitted yet — fall through and try the next provider.
    }
  }

  // Every configured provider failed (or none configured).
  console.error("[AI] All providers failed");
  callbacks.onError(new LlmUnavailableError());
}
