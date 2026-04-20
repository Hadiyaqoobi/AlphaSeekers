/**
 * System prompts for the RAG study assistant.
 *
 * Supports Dari and English with bilingual awareness.
 * Prompts enforce grounding in retrieved context to minimize hallucination.
 */

export type RagContext = {
  query: string;
  locale: string;
  chunks: Array<{
    content: string;
    sourceTitle: string;
    similarity: number;
  }>;
};

function formatContext(chunks: RagContext["chunks"]): string {
  return chunks
    .map(
      (chunk, i) =>
        `[Source ${i + 1}: "${chunk.sourceTitle}" (relevance: ${(chunk.similarity * 100).toFixed(0)}%)]\n${chunk.content}`,
    )
    .join("\n\n---\n\n");
}

const SYSTEM_PROMPT_EN = `You are the AlphaSeekers Study Assistant, an AI tutor for Afghan students.

RULES:
1. Answer ONLY based on the provided context below. Do not use prior knowledge.
2. If the context does not contain enough information, say: "I don't have enough information in the course materials to answer this. Please ask your teacher."
3. Cite which source(s) you used, e.g. [Source 1].
4. Keep answers clear, concise, and educational.
5. Be encouraging and supportive — many students face challenging learning conditions.
6. If the student writes in Dari, respond in Dari.
7. If the student writes in English, respond in English.`;

const SYSTEM_PROMPT_FA = `شما دستیار مطالعه آلفاسیکرز هستید، یک معلم هوش مصنوعی برای دانش‌آموزان افغان.

قوانین:
۱. فقط بر اساس متن ارائه شده در زیر پاسخ دهید. از دانش قبلی استفاده نکنید.
۲. اگر متن اطلاعات کافی ندارد، بگویید: «اطلاعات کافی در مواد درسی وجود ندارد. لطفاً از معلم خود بپرسید.»
۳. منبع(های) مورد استفاده خود را ذکر کنید، مثلاً [منبع ۱].
۴. پاسخ‌ها را واضح، مختصر و آموزنده نگه دارید.
۵. دلگرم‌کننده و حمایتی باشید.
۶. اگر دانش‌آموز به دری می‌نویسد، به دری پاسخ دهید.
۷. اگر دانش‌آموز به انگلیسی می‌نویسد، به انگلیسی پاسخ دهید.`;

/**
 * Build the chat messages array for the RAG completion.
 * Includes the system prompt, retrieved context, and student query.
 */
export function buildRagMessages(context: RagContext) {
  const systemPrompt = context.locale === "fa" ? SYSTEM_PROMPT_FA : SYSTEM_PROMPT_EN;
  const formattedContext = formatContext(context.chunks);

  const contextLabel = context.locale === "fa" ? "متن مرجع" : "Reference Materials";
  const questionLabel = context.locale === "fa" ? "سوال دانش‌آموز" : "Student Question";

  return [
    { role: "system" as const, content: systemPrompt },
    {
      role: "user" as const,
      content: `${contextLabel}:\n\n${formattedContext}\n\n---\n\n${questionLabel}: ${context.query}`,
    },
  ];
}

/**
 * Fallback message when no indexed content is available.
 */
export function buildNoContextMessage(locale: string) {
  if (locale === "fa") {
    return "متأسفم، هنوز هیچ مواد درسی برای جستجو فهرست‌بندی نشده است. لطفاً بعداً دوباره امتحان کنید یا از معلم خود بپرسید.";
  }

  return "Sorry, no course materials have been indexed yet. Please try again later or ask your teacher.";
}

/**
 * Disclaimer prepended to a general-knowledge answer when no course materials
 * are indexed. Signals clearly to the student that the response is NOT grounded
 * in their curriculum.
 */
export function buildGeneralKnowledgeDisclaimer(locale: string) {
  if (locale === "fa") {
    // TODO: NEEDS DARI TRANSLATION FROM TEAM
    return "(General answer — no course materials indexed yet; please ask your teacher to verify.)\n\n";
  }

  return "(General answer — no course materials indexed yet; please ask your teacher to verify.)\n\n";
}

/**
 * Build chat messages for a general-knowledge answer when RAG finds no matching
 * course materials. Responds in the student's language without requiring sources.
 */
export function buildGeneralKnowledgeMessages(query: string, locale: string) {
  const systemPrompt = `You are the AlphaSeekers Study Assistant, an AI tutor for Afghan students.

No course materials have been indexed on this platform yet, so you cannot cite sources. Answer the student's question using your general knowledge, but:

1. Be clear, concise, and age-appropriate.
2. If the student writes in Dari, respond in Dari. If they write in English, respond in English.
3. Do not fabricate citations. Do not claim to cite a textbook.
4. End with a brief reminder to check with their teacher for course-specific topics.
5. Be encouraging — many students face difficult learning conditions.`;

  const questionLabel = locale === "fa" ? "سوال دانش‌آموز" : "Student Question";

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: `${questionLabel}: ${query}` },
  ];
}
