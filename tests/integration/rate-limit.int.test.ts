/**
 * Integration tests for the distributed rate limiter, against a REAL Postgres.
 *
 * Registration was capped at 5 attempts per 15 minutes keyed on IP alone. Afghan
 * mobile carriers put many subscribers behind one public address, so that was
 * effectively five attempts per NETWORK: during an enrolment campaign the sixth
 * student to sign up was refused on their first ever attempt. These tests pin
 * that a custom config is honoured and that separate keys hold separate budgets.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "ratelimittest";

async function cleanup() {
  await prisma.rateLimitBucket.deleteMany({ where: { key: { contains: TAG } } });
}

const WINDOW = 15 * 60 * 1000;

d("distributed rate limiter", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("honours a custom limit rather than the shared auth default of 5", async () => {
    const key = `${TAG}:custom`;
    const config = { limit: 3, windowMs: WINDOW };

    for (let i = 0; i < 3; i += 1) {
      expect((await checkRateLimitDistributed(key, config)).allowed).toBe(true);
    }

    const blocked = await checkRateLimitDistributed(key, config);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("gives each key its own budget, so one person cannot exhaust another's", async () => {
    // This is the whole point of keying registration on email rather than IP:
    // two students on the same carrier must not share a five-attempt allowance.
    const config = { limit: 2, windowMs: WINDOW };
    const a = `${TAG}:email:first@example.com`;
    const b = `${TAG}:email:second@example.com`;

    expect((await checkRateLimitDistributed(a, config)).allowed).toBe(true);
    expect((await checkRateLimitDistributed(a, config)).allowed).toBe(true);
    expect((await checkRateLimitDistributed(a, config)).allowed).toBe(false);

    // Second student, untouched budget.
    expect((await checkRateLimitDistributed(b, config)).allowed).toBe(true);
  });

  it("lets a much looser ceiling through where a tight one would block", async () => {
    // The per-IP ceiling still exists to stop a flood, it is just no longer the
    // thing that refuses the sixth legitimate signup on a shared carrier.
    const key = `${TAG}:ip:203.0.113.7`;
    const loose = { limit: 30, windowMs: WINDOW };

    for (let i = 0; i < 20; i += 1) {
      expect((await checkRateLimitDistributed(key, loose)).allowed).toBe(true);
    }
  });
});

d("registration is open, course access is not", () => {
  beforeEach(cleanup);

  it("creates a usable account immediately", async () => {
    // Removing the platform gate was the point: a student can sign in at once.
    // What they still cannot do is put themselves in a class — that is a
    // request an admin approves (see course-access.int.test.ts).
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/api/auth/register/route.ts", "utf8"),
    );
    expect(src).toMatch(/approvedAt:\s*new Date\(\)/);
    expect(src).not.toMatch(/approvedAt:\s*null/);
  });

  it("leaves every AI route rate limited", async () => {
    // Groq's free tier caps tokens per day across the whole key, so an
    // unlimited route lets one user starve every student.
    const fs = await import("node:fs");
    for (const route of [
      "src/app/api/ai/ask/route.ts",
      "src/app/api/ai/quick/route.ts",
      "src/app/api/learn/lesson/route.ts",
      "src/app/api/learn/generate-path/route.ts",
    ]) {
      expect(fs.readFileSync(route, "utf8"), route).toMatch(/checkRateLimit/);
    }
  });
});
