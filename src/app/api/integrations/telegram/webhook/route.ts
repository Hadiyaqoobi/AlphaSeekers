import { NextRequest, NextResponse } from "next/server";

import { linkTokens } from "@/lib/integrations/telegram-link-tokens";
import { prisma } from "@/lib/prisma";

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
      await sendTelegramReply(chatId, "This link has expired. Please generate a new one from your AlphaSeekers profile.");
      return NextResponse.json({ ok: true });
    }

    // Store the chat ID on the user
    await prisma.user.update({
      where: { id: entry.userId },
      data: { telegramChatId: chatId },
    });

    // Remove used token
    linkTokens.delete(token);

    await sendTelegramReply(
      chatId,
      `Welcome to AlphaSeekers, ${firstName}! Your Telegram is now linked. You will receive class notifications here.`,
    );

    return NextResponse.json({ ok: true });
  }

  // Handle plain /start (no token)
  if (text === "/start") {
    await sendTelegramReply(
      chatId,
      "Welcome! To link your AlphaSeekers account, use the link from your profile page.",
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

async function sendTelegramReply(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {
    // Best-effort reply
  });
}
