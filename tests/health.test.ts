/**
 * Unit tests for GET /api/health.
 *
 * Render calls this path every few seconds for as long as the service runs. The
 * one property that must never regress is that the plain form does not touch the
 * database: when it did, Neon's compute could never suspend and the free
 * allowance ran out mid-month. Prisma is mocked so that is asserted directly.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn(async () => [{ "?column?": 1 }]);

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));
vi.mock("@/lib/runtime", () => ({ runtime: { allowDbFallback: false } }));

const { GET } = await import("@/app/api/health/route");

const call = (query = "") => GET(new Request(`https://alphaseekers.org/api/health${query}`));

describe("GET /api/health", () => {
  beforeEach(() => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  });

  it("answers the liveness probe without querying the database", async () => {
    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, status: "ok", db: "unchecked" });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("stays healthy on the liveness probe even when the database is down", async () => {
    queryRaw.mockRejectedValue(new Error("compute time quota exceeded"));

    const response = await call();

    expect(response.status).toBe(200);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("checks the database only when asked with ?deep=1", async () => {
    const response = await call("?deep=1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, db: "up" });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("reports 503 on the deep check when a required database is unreachable", async () => {
    queryRaw.mockRejectedValue(new Error("down"));

    const response = await call("?deep=1");
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ ok: false, status: "degraded", db: "down" });
  });
});
