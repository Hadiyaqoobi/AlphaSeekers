import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { AI_NOT_CONFIGURED_MESSAGE, aiConfig } from "@/lib/ai/config";
import { createRagStream, ragQuery } from "@/lib/ai/rag-pipeline";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";

const askSchema = z.object({
  query: z.string().min(3).max(1000),
  // The page locale. When a client omits it we use the student's saved
  // language (the platform default is Dari) — never silently English.
  locale: z.enum(["en", "fa"]).optional(),
  stream: z.boolean().default(true),
});

async function savedLocale(userId: string): Promise<"en" | "fa"> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { language: true } });
  return row?.language === "EN" ? "en" : "fa";
}

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
    return Response.json({ message: AI_NOT_CONFIGURED_MESSAGE, code: "AI_NOT_CONFIGURED" }, { status: 503 });
  }

  // Per-user limit, shared across server instances and with the Telegram
  // tutor (same key), so one student cannot drain the shared Groq quota.
  const rl = await checkRateLimitDistributed(`ai-ask:${user.id}`, aiConfig.rateLimits.ask);
  if (!rl.allowed) {
    const retryAfter = Math.ceil(rl.retryAfterMs / 1000);
    return Response.json(
      { message: "Too many AI queries. Please wait a few minutes.", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = askSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Invalid query. Must be 3–1000 characters.");
  }

  const { query, stream } = parsed.data;
  const locale = parsed.data.locale ?? (await savedLocale(user.id));

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
