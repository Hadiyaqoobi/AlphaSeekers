/**
 * Once a handler has run, its side effects (emails, pushes) have happened. A
 * failure to RECORD completion used to fall into the handler's catch, mark the
 * job FAILED and re-run the whole fan-out on retry. It is now isolated.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

let failNextComplete = false;
vi.mock("@/lib/jobs/queue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs/queue")>();
  return {
    ...actual,
    markCompleted: async (jobId: string) => {
      if (failNextComplete) {
        failNextComplete = false;
        throw new Error("connection reset");
      }
      return actual.markCompleted(jobId);
    },
  };
});

const { prisma } = await import("@/lib/prisma");
const { enqueue } = await import("@/lib/jobs/queue");
const { drainOnce, registerHandler } = await import("@/lib/jobs/worker");

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;

d("worker completion bookkeeping", () => {
  beforeEach(async () => {
    await prisma.job.deleteMany({});
  });
  afterAll(async () => {
    await prisma.job.deleteMany({});
  });

  it("does not retry a job whose handler succeeded when recording completion fails once", async () => {
    let runs = 0;
    registerHandler("test_side_effect", async () => {
      runs += 1;
    });
    const { id } = await enqueue("test_side_effect", {});

    failNextComplete = true;
    const result = await drainOnce({ workerId: "w", batchSize: 10 });

    expect(result.succeeded).toBe(1);
    expect(result.retried).toBe(0);
    expect(runs).toBe(1);
    expect((await prisma.job.findUniqueOrThrow({ where: { id } })).status).toBe("COMPLETED");
  });
});
