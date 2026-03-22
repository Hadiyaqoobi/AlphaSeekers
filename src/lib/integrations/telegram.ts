import { NonRetryableError } from "@/lib/retry";

import type { NotificationTarget } from "./notifications";

export async function sendTelegram(target: NotificationTarget, content: string): Promise<string> {
  if (!target.telegramChatId) {
    throw new NonRetryableError("Missing Telegram chat ID");
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new NonRetryableError("Telegram bot token missing");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: target.telegramChatId,
      text: content,
      disable_web_page_preview: true,
    }),
  });

  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    result?: { message_id?: number };
    description?: string;
  } | null;

  if (!response.ok || !body?.ok) {
    throw new Error(body?.description ?? `Telegram API error (${response.status})`);
  }

  return `Telegram sent (${body.result?.message_id ?? "ok"})`;
}
