/**
 * In-memory sliding-window rate limiter.
 *
 * Designed for Vercel serverless: resets on cold start, which is acceptable
 * because cold starts are infrequent (Neon warm-up cron keeps the function warm).
 *
 * BRD §4.2: "Rate limiting on auth endpoints (prevent brute force)"
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// Clean up expired entries every 5 minutes to prevent unbounded growth.
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;

    for (const [key, entry] of Array.from(store.entries())) {
        if (now > entry.resetAt) {
            store.delete(key);
        }
    }
}

export type RateLimitConfig = {
    /** Maximum requests allowed within the window. */
    limit: number;
    /** Window duration in milliseconds. */
    windowMs: number;
};

const AUTH_CONFIG: RateLimitConfig = { limit: 5, windowMs: 15 * 60 * 1000 };

/**
 * Check rate limit for the given key (typically IP address).
 * Returns `{ allowed: true }` or `{ allowed: false, retryAfterMs }`.
 */
export function checkRateLimit(
    key: string,
    config: RateLimitConfig = AUTH_CONFIG,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
    cleanup();

    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + config.windowMs });
        return { allowed: true };
    }

    if (entry.count < config.limit) {
        entry.count += 1;
        return { allowed: true };
    }

    return { allowed: false, retryAfterMs: entry.resetAt - now };
}

/**
 * Extract a best-effort client IP from a Next.js request.
 */
export function getClientIp(request: Request): string {
    const forwarded = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
    const real = request.headers.get("x-real-ip");
    return forwarded || real || "unknown";
}
