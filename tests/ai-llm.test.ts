/**
 * LLM client shaping. The Google backup was dead on arrival: Gemma models
 * reject `systemInstruction` ("Developer instruction is not enabled"), and
 * every caller sends a system message, so every failover failed. These tests
 * pin the request shape. All network calls are mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clampScore, shouldEvaluate } from "@/lib/ai/evaluation/llm-judge";
import { parseJsonObject, supportsSystemInstruction, toGoogleFormat, type ChatMessage } from "@/lib/ai/llm";

const msgs: ChatMessage[] = [
  { role: "system", content: "RULES" },
  { role: "user", content: "What is 2+2?" },
];

describe("toGoogleFormat", () => {
  it("folds the system text into the first user turn for Gemma (no systemInstruction)", () => {
    const out = toGoogleFormat(msgs, "gemma-3-27b-it");
    expect(out.systemInstruction).toBeUndefined();
    expect(out.contents).toEqual([{ role: "user", parts: [{ text: "RULES\n\nWhat is 2+2?" }] }]);
  });

  it("keeps systemInstruction for Gemini models", () => {
    const out = toGoogleFormat(msgs, "gemini-2.5-flash");
    expect(out.systemInstruction).toEqual({ parts: [{ text: "RULES" }] });
    expect(out.contents).toEqual([{ role: "user", parts: [{ text: "What is 2+2?" }] }]);
  });

  it("treats a models/-prefixed Gemma id the same way", () => {
    expect(supportsSystemInstruction("models/gemma-3-12b-it")).toBe(false);
    expect(supportsSystemInstruction("GEMMA-2-9b")).toBe(false);
    expect(supportsSystemInstruction("gemini-2.0-flash")).toBe(true);
  });

  it("opens with a user turn when the conversation starts with the model", () => {
    const out = toGoogleFormat(
      [
        { role: "system", content: "S" },
        { role: "assistant", content: "hi" },
        { role: "user", content: "q" },
      ],
      "gemma-3-27b-it",
    );
    expect(out.contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(out.contents[0].parts[0].text).toBe("S");
    expect(out.contents[2].parts[0].text).toBe("q");
  });

  it("does not mutate the caller's messages", () => {
    const copy = JSON.parse(JSON.stringify(msgs));
    toGoogleFormat(msgs, "gemma-3-27b-it");
    expect(msgs).toEqual(copy);
  });
});

describe("parseJsonObject", () => {
  it("reads fenced JSON with prose around it", () => {
    expect(parseJsonObject('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("returns null for a truncated object instead of throwing", () => {
    expect(parseJsonObject('{"sections":[{"type":"explanation"')).toBeNull();
    expect(parseJsonObject("no json here")).toBeNull();
  });
});

describe("answer grading is sampled", () => {
  it("never grades at rate 0 and always at rate 1", () => {
    expect(shouldEvaluate(0, () => 0)).toBe(false);
    expect(shouldEvaluate(1, () => 0.999)).toBe(true);
  });
  it("grades only when the draw falls under the rate", () => {
    expect(shouldEvaluate(0.05, () => 0.04)).toBe(true);
    expect(shouldEvaluate(0.05, () => 0.06)).toBe(false);
  });
  it("defaults to a 5% sample", async () => {
    const { aiConfig } = await import("@/lib/ai/config");
    expect(aiConfig.evaluation.sampleRate).toBe(0.05);
  });
});

describe("clampScore (human review input)", () => {
  it("clamps to [0,1] and rejects non-numbers", () => {
    expect(clampScore(7)).toBe(1);
    expect(clampScore(-2)).toBe(0);
    expect(clampScore(0.4)).toBe(0.4);
    expect(clampScore(Number.NaN)).toBeNull();
    expect(clampScore(Infinity)).toBeNull();
    expect(clampScore("0.5")).toBeNull();
  });
});

describe("generateCompletion → Gemma fallback request", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.GROQ_API_KEY = "groq-test";
    process.env.GEMMA_API_KEY = "gemma-test";
    process.env.GEMMA_MODEL = "gemma-3-27b-it";
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
  });

  it("falls over to Gemma without systemInstruction and returns its text", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes("groq")) return new Response("rate limited", { status: 429 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "4" }] } }] }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { generateCompletion } = await import("@/lib/ai/llm");
    await expect(generateCompletion(msgs)).resolves.toBe("4");

    const gemmaCall = fetchMock.mock.calls.find(([url]) => String(url).includes("generativelanguage"));
    expect(gemmaCall).toBeDefined();
    const body = JSON.parse(String((gemmaCall![1] as RequestInit).body));
    expect(body.systemInstruction).toBeUndefined();
    expect(body.contents[0].parts[0].text).toBe("RULES\n\nWhat is 2+2?");
  });

  it("sends Groq JSON mode and the per-call token ceiling", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { generateCompletion } = await import("@/lib/ai/llm");
    await generateCompletion(msgs, { maxTokens: 2500, json: true });

    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.max_tokens).toBe(2500);
    expect(body.response_format).toEqual({ type: "json_object" });
  });
});
