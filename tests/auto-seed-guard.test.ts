/**
 * Auto-seeding inserts a demo ADMIN, 150 fake students and published catalog
 * classes. It used to be ON in every non-production NODE_ENV, and dev and prod
 * have shared one Neon database, so a `next dev` against it seeded production.
 *
 * Now it is opt-in (ALPHASEEKERS_AUTO_SEED=true) and, even when opted in,
 * refuses any *.neon.tech host. Prisma is replaced with a tripwire here, so the
 * test proves no query is even attempted.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL = { ...process.env };

function tripwire() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined;
        throw new Error(`prisma.${String(prop)} touched`);
      },
    },
  );
}

async function loadWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.doMock("@/lib/prisma", () => ({ prisma: tripwire() }));
  const runtime = await import("@/lib/runtime");
  const store = await import("@/lib/platform/db-store");
  return { runtime: runtime.runtime, ensureSeededData: store.ensureSeededData };
}

describe("auto-seed guard", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL };
    vi.doUnmock("@/lib/prisma");
    vi.restoreAllMocks();
  });

  it("is off by default, even outside production", async () => {
    const { runtime, ensureSeededData } = await loadWith({
      ALPHASEEKERS_AUTO_SEED: undefined,
      ALPHASEEKERS_MODE: "demo",
    });
    expect(runtime.mode).toBe("demo");
    expect(runtime.allowAutoSeed).toBe(false);
    await expect(ensureSeededData()).resolves.toBeUndefined();
  });

  it("is on only when ALPHASEEKERS_AUTO_SEED=true", async () => {
    const { runtime } = await loadWith({ ALPHASEEKERS_AUTO_SEED: "true", ALPHASEEKERS_MODE: "demo" });
    expect(runtime.allowAutoSeed).toBe(true);
  });

  it.each([
    "postgresql://u:p@ep-cool-name-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
    "postgresql://u:p@EP-UPPER.US-EAST-2.AWS.NEON.TECH/neondb",
  ])("refuses to seed a Neon database even when opted in (%s)", async (url) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ensureSeededData } = await loadWith({
      ALPHASEEKERS_AUTO_SEED: "true",
      ALPHASEEKERS_MODE: "demo",
      DATABASE_URL: url,
    });
    // The tripwire throws on any prisma access, so resolving proves no write.
    await expect(ensureSeededData()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("REFUSING to auto-seed"));
  });
});
