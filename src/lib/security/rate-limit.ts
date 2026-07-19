/**
 * Rate limiting for auth endpoints.
 *
 * `checkRateLimit` is an in-memory sliding-window limiter. It resets on cold
 * start, which is fine per-instance but does NOT share state across serverless
 * instances — a brute-forcer that spreads attempts across instances slips
 * through. `checkRateLimitDistributed` backs the same window with a Postgres
 * row (prisma.rateLimitBucket) so the limit is enforced globally, and falls
 * back to the in-memory limiter on any DB error so auth never hard-fails.
 *
 * BRD §4.2: "Rate limiting on auth endpoints (prevent brute force)"
 */

import { prisma } from "@/lib/prisma";

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

/**
 * Minimal structural view of the RateLimitBucket delegate.
 *
 * The Prisma model is added by Bundle C (schema.prisma) and the generated
 * client may not yet expose it when this file is type-checked; we access it
 * structurally and fall back to the in-memory limiter if it is absent.
 */
type RateLimitBucketDelegate = {
    upsert(args: {
        where: { key: string };
        create: { key: string; count: number; resetAt: Date };
        update: { count: { increment: number } };
    }): Promise<{ key: string; count: number; resetAt: Date }>;
};

/**
 * Distributed fixed-window rate limiter backed by prisma.rateLimitBucket.
 *
 * The window is aligned to `windowMs` and encoded into the row key, so each
 * window gets its own row and a single atomic upsert increments the counter
 * (no check-then-write race). Stale rows are reclaimable via the
 * `@@index([resetAt])` on the model.
 *
 * On ANY database error — or if the model is not present in the client yet —
 * it falls back to the existing in-memory `checkRateLimit`.
 */
export async function checkRateLimitDistributed(
    key: string,
    config: RateLimitConfig = AUTH_CONFIG,
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
    const now = Date.now();
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    const resetAt = new Date(windowStart + config.windowMs);
    const bucketKey = `${key}:${windowStart}`;

    const model = (prisma as unknown as { rateLimitBucket?: RateLimitBucketDelegate })
        .rateLimitBucket;
    if (!model) {
        return checkRateLimit(key, config);
    }

    try {
        const bucket = await model.upsert({
            where: { key: bucketKey },
            create: { key: bucketKey, count: 1, resetAt },
            update: { count: { increment: 1 } },
        });

        if (bucket.count > config.limit) {
            return { allowed: false, retryAfterMs: Math.max(0, bucket.resetAt.getTime() - now) };
        }
        return { allowed: true };
    } catch {
        // DB unavailable / model missing at runtime → degrade gracefully.
        return checkRateLimit(key, config);
    }
}
