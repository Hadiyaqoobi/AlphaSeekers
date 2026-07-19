import { NonRetryableError } from "@/lib/retry";

import type { NotificationTarget } from "./notifications";

/**
 * Whether a Telegram bot token is configured. Callers can use this to skip the
 * Telegram channel without producing a failed-delivery per recipient.
 */
export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export async function sendTelegram(target: NotificationTarget, content: string): Promise<string> {
  if (!target.telegramChatId) {
    throw new NonRetryableError("Missing Telegram chat ID");
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    // Graceful, non-retryable: caught by the fallback chain, no retry storm.
    throw new NonRetryableError("Telegram bot token missing");
  }

  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: target.telegramChatId,
        text: content,
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // Never surface the raw error — the request URL embeds the bot token, so a
    // leaked fetch error message could expose it. Emit a sanitized message.
    throw new Error("Telegram request failed (network error)");
  }

  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    result?: { message_id?: number };
    description?: string;
  } | null;

  if (!response.ok || !body?.ok) {
    // Telegram's `description` is safe (it never contains the token).
    throw new Error(body?.description ?? `Telegram API error (${response.status})`);
  }

  return `Telegram sent (${body.result?.message_id ?? "ok"})`;
}
