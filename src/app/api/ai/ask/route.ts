import { NextRequest } from "next/server";
import { z } from "zod";

import { aiConfig } from "@/lib/ai/config";
import { createRagStream, ragQuery } from "@/lib/ai/rag-pipeline";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";

const askSchema = z.object({
  query: z.string().min(3).max(1000),
  locale: z.enum(["en", "fa"]).default("en"),
  stream: z.boolean().default(true),
});

/**
 * POST /api/ai/ask
 *
 * Student submits a question → RAG pipeline retrieves relevant chunks
 * and generates a grounded answer via Llama 3.1.
 *
 * Supports streaming (SSE) and non-streaming modes.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!user.approved) return forbidden("Account pending approval");

  if (!aiConfig.enabled) {
    return Response.json(
      { message: "AI features are not configured on this instance." },
      { status: 503 },
    );
  }

  // Rate limit: 20 AI queries per 15 minutes per user
  const rl = checkRateLimit(`ai:${user.id}`, { limit: 20, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return Response.json(
      { message: "Too many AI queries. Please wait a few minutes." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = askSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Invalid query. Must be 3–1000 characters.");
  }

  const { query, locale, stream } = parsed.data;

  if (stream) {
    const readableStream = createRagStream({ query, locale, userId: user.id });
    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  try {
    const result = await ragQuery({ query, locale, userId: user.id });
    return Response.json(result);
  } catch (error) {
    console.error("[AI] RAG query failed:", error);
    return Response.json(
      { message: "Failed to process your question. Please try again." },
      { status: 500 },
    );
  }
}
