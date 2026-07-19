/**
 * POST /api/ai/review-homework
 *
 * Student uploads a photo of their homework.
 * AI reads it (vision) and provides corrections and feedback.
 *
 * Uses Gemini Flash (via Google AI Studio, same API key as Gemma).
 * Gemini Flash has a generous free tier (1,500 RPD).
 *
 * Request: FormData with 'image' file, optional 'classId', optional 'instructions'.
 */

import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { aiConfig } from "@/lib/ai/config";
import { buildStudentContext } from "@/lib/ai/student-context";
import { classifyContent } from "@/lib/ai/safety/content-classifier";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";

const VISION_MODEL = process.env.GEMINI_VISION_MODEL ?? "gemini-2.0-flash-exp";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!user.approved) return forbidden("Account pending approval");

  if (!aiConfig.gemma.configured) {
    return Response.json(
      { message: "Homework review requires a Google AI Studio key (GEMMA_API_KEY)." },
      { status: 503 },
    );
  }

  // Per-user rate limit — vision calls are the most expensive AI operation, so a
  // single student must not be able to exhaust the shared quota.
  const rl = await checkRateLimitDistributed(
    `ai-homework:${user.id}`,
    aiConfig.rateLimits.reviewHomework,
  );
  if (!rl.allowed) {
    const retryAfter = Math.ceil(rl.retryAfterMs / 1000);
    return Response.json(
      { message: "You've reviewed a lot of homework recently. Please try again shortly.", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest("Invalid form data");
  }

  const image = formData.get("image") as File | null;
  const classId = (formData.get("classId") as string) || null;
  const instructions =
    (formData.get("instructions") as string) ||
    "Review my homework and point out any mistakes.";

  if (!image) return badRequest("No image provided");
  if (!image.type.startsWith("image/")) return badRequest("File must be an image");
  if (image.size > MAX_IMAGE_SIZE) return badRequest("Image must be under 5MB");

  try {
    const imageBuffer = await image.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    // Student context for personalized feedback
    const studentContext = await buildStudentContext(user.id, instructions);

    const className = classId
      ? studentContext.enrolledClasses.find((c) => c.classId === classId)?.className ||
        "your class"
      : studentContext.enrolledClasses[0]?.className || "your class";

    const reviewPrompt = buildHomeworkReviewPrompt(
      studentContext.estimatedLevel || "beginner",
      studentContext.preferredLanguage,
      className,
      instructions,
    );

    // Bound the vision call with an AbortController timeout so a hung upstream
    // generation cannot pin the instance.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), aiConfig.timeouts.visionMs);
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${aiConfig.gemma.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: reviewPrompt },
                  { inlineData: { mimeType: image.type, data: base64Image } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1500,
            },
          }),
          signal: controller.signal,
        },
      );
    } catch (fetchErr) {
      const timedOut = fetchErr instanceof Error && fetchErr.name === "AbortError";
      console.error("[Homework] Vision API request failed:", timedOut ? "timeout" : fetchErr);
      return Response.json(
        { message: "The review took too long. Please try again with a clearer photo." },
        { status: 504 },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[Homework] Vision API error:", response.status, errorText.slice(0, 500));
      return Response.json(
        { message: "Failed to analyze the image. Please try again with a clearer photo." },
        { status: 500 },
      );
    }

    const data = await response.json();
    const review =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Unable to read the image. Please try again with a clearer photo.";

    // Safety check on the review output
    const safetyResult = classifyContent(review, instructions);
    if (!safetyResult.safe) {
      console.warn("[Homework] Blocked unsafe response:", safetyResult.reason);
      return Response.json(
        {
          review:
            "I couldn't review this homework safely. Please try again or ask your teacher directly.",
          className,
          mode: "homework_review",
        },
      );
    }

    // Log the interaction
    await logHomeworkReview(user.id, classId, instructions, review);

    return Response.json({
      review,
      className,
      mode: "homework_review",
    });
  } catch (error) {
    console.error("[Homework] Review failed:", error);
    return Response.json({ message: "Failed to review homework" }, { status: 500 });
  }
}

function buildHomeworkReviewPrompt(
  level: string,
  preferredLanguage: "en" | "fa",
  className: string,
  instructions: string,
): string {
  const lang = preferredLanguage === "fa" ? "Dari" : "English";

  return `You are a kind, encouraging tutor reviewing a student's homework for ${className}.

STUDENT INFO:
- Language level: ${level}
- Preferred language: ${lang}
- They asked: "${instructions}"

INSTRUCTIONS:
1. First, read and transcribe what you see in the image (handwritten or typed text).
2. Then evaluate the work:
   - For language homework: check grammar, spelling, sentence structure. Correct errors gently.
   - For math/science: check calculations step by step. Point out where errors occur.
   - For essays/writing: comment on structure, clarity, and content.
3. Give a summary: e.g. "3 errors found" or "Mostly correct! Great work."
4. For each error, explain:
   - What the error is
   - Why it's wrong
   - What the correct version should be
5. End with encouragement and one specific thing the student did well.

If the image is unclear, say so honestly and ask for a clearer photo.
Respond in ${lang} if the homework is in ${lang}.`;
}

async function logHomeworkReview(
  userId: string,
  classId: string | null,
  prompt: string,
  review: string,
): Promise<void> {
  try {
    await prisma.aIInteraction.create({
      data: {
        userId,
        query: `[HOMEWORK REVIEW] ${prompt}`,
        answer: review,
        mode: "homework_review",
        classIds: classId,
        provider: "gemini-vision",
      },
    });
  } catch (err) {
    console.error("[Homework] Logging failed:", err);
  }
}
