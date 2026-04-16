import { NextRequest, NextResponse } from "next/server";

import { linkTokens } from "@/lib/integrations/telegram-link-tokens";
import { prisma } from "@/lib/prisma";
import { aiConfig } from "@/lib/ai/config";
import { ragQuery } from "@/lib/ai/rag-pipeline";

type TelegramUpdate = {
  message?: {
    chat?: { id?: number };
    text?: string;
    from?: { first_name?: string };
  };
};

export async function POST(request: NextRequest) {
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;

  if (!update?.message?.chat?.id || !update.message.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(update.message.chat.id);
  const text = update.message.text.trim();
  const firstName = update.message.from?.first_name ?? "";

  // Handle /start {linkToken} command
  if (text.startsWith("/start ")) {
    const token = text.slice(7).trim();
    const entry = linkTokens.get(token);

    if (!entry || entry.expiresAt < Date.now()) {
      await sendTelegramReply(
        chatId,
        "This link has expired. Please generate a new one from your AlphaSeekers profile.",
      );
      return NextResponse.json({ ok: true });
    }

    await prisma.user.update({
      where: { id: entry.userId },
      data: { telegramChatId: chatId },
    });
    linkTokens.delete(token);

    await sendTelegramReply(
      chatId,
      `Welcome to AlphaSeekers, ${firstName}! Your Telegram is now linked. You can now ask me study questions here.`,
    );

    return NextResponse.json({ ok: true });
  }

  // Plain /start (no token)
  if (text === "/start") {
    await sendTelegramReply(
      chatId,
      "Welcome! To link your AlphaSeekers account, use the link from your profile page.",
    );
    return NextResponse.json({ ok: true });
  }

  // AI TUTOR: Route text messages through the RAG pipeline
  const user = await prisma.user.findFirst({
    where: { telegramChatId: chatId },
  });

  if (!user) {
    await sendTelegramReply(
      chatId,
      "Please link your Telegram account on the AlphaSeekers website first.",
    );
    return NextResponse.json({ ok: true });
  }

  if (!user.approvedAt && user.role !== "ADMIN") {
    await sendTelegramReply(
      chatId,
      "Your account is pending approval. You'll be notified once approved.",
    );
    return NextResponse.json({ ok: true });
  }

  if (!aiConfig.enabled) {
    await sendTelegramReply(
      chatId,
      "AI tutor is not configured on this instance. Please use the website.",
    );
    return NextResponse.json({ ok: true });
  }

  if (text.length < 3) {
    return NextResponse.json({ ok: true });
  }

  // Send "thinking" indicator for long queries
  await sendChatAction(chatId, "typing");

  try {
    const result = await ragQuery({
      query: text,
      locale: user.language === "FA" ? "fa" : "en",
      userId: user.id,
    });

    let response = result.answer;

    if (result.sources.length > 0) {
      const sourceList = result.sources.slice(0, 3).map((s) => s.title).join(", ");
      response += `\n\n📚 Sources: ${sourceList}`;
    }

    // Telegram limit: 4096 chars per message
    if (response.length > 4000) {
      response = response.substring(0, 3990) + "...";
    }

    await sendTelegramReply(chatId, response);
  } catch (err) {
    console.error("[Telegram AI] Failed:", err);
    await sendTelegramReply(
      chatId,
      "I couldn't process your question right now. Please try again or use the website.",
    );
  }

  return NextResponse.json({ ok: true });
}

async function sendTelegramReply(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  }).catch(() => {});
}

async function sendChatAction(chatId: string, action: "typing") {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {});
}
