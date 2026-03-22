// In-memory token store for Telegram account linking (short-lived, cleared on server restart)
export const linkTokens = new Map<string, { userId: string; expiresAt: number }>();

export function cleanupExpiredTokens() {
  const now = Date.now();
  linkTokens.forEach((entry, token) => {
    if (entry.expiresAt < now) {
      linkTokens.delete(token);
    }
  });
}
