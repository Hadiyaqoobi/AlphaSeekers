import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { cleanupExpiredTokens, linkTokens } from "@/lib/integrations/telegram-link-tokens";
import { getSessionUser } from "@/lib/security/session";
import { prisma } from "@/lib/prisma";

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Check if already linked
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { telegramChatId: true },
  });

  return NextResponse.json({
    linked: !!dbUser?.telegramChatId,
  });
}

export async function POST() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  cleanupExpiredTokens();

  const token = crypto.randomBytes(12).toString("base64url");
  linkTokens.set(token, {
    userId: user.id,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;

  if (!botUsername) {
    return NextResponse.json({ message: "Telegram bot not configured" }, { status: 503 });
  }

  return NextResponse.json({
    url: `https://t.me/${botUsername}?start=${token}`,
  });
}

export async function DELETE() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: null },
  });

  return NextResponse.json({ unlinked: true });
}
