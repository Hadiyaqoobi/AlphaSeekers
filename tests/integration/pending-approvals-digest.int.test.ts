/**
 * Integration tests for the daily "people are waiting for approval" nudge.
 *
 * A new signup lands with approvedAt=null and cannot enrol in anything until an
 * admin approves them. Nothing surfaced that queue, so during an enrolment
 * campaign a student could sit locked out for days while eight of them piled up
 * unnoticed.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";

const deliverToMany = vi.fn(async () => 0);
vi.mock("@/lib/jobs/handlers/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs/handlers/notifications")>();
  return { ...actual, deliverToMany };
});

const { pendingApprovalsDigest } = await import("@/lib/jobs/handlers/digest");

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "approvaldigest";
const email = (s: string) => `${TAG}+${s}@example.com`;

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}+` } } });
}

async function makeUser(slug: string, over: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: { name: `${TAG} ${slug}`, email: email(slug), role: "STUDENT", ...over },
    select: { id: true },
  });
}

d("pending approvals digest", () => {
  beforeEach(async () => {
    await cleanup();
    deliverToMany.mockClear();
    // Approve every pre-existing account so only this test's fixtures are pending.
    await prisma.user.updateMany({ where: { approvedAt: null }, data: { approvedAt: new Date() } });
    // Likewise close any open teacher request left by other fixtures.
    await prisma.user.updateMany({
      where: { role: "STUDENT", requestedRole: "TEACHER" },
      data: { requestedRole: null },
    });
  });
  afterAll(cleanup);

  it("sends nothing when nobody is waiting", async () => {
    await pendingApprovalsDigest();
    // A daily "0 waiting" email is noise that trains people to filter the thread.
    expect(deliverToMany).not.toHaveBeenCalled();
  });

  it("reports the count and separates teacher applicants from students", async () => {
    await makeUser("s1", { approvedAt: null });
    await makeUser("s2", { approvedAt: null });
    await makeUser("t1", { approvedAt: null, requestedRole: "TEACHER" });

    const admin = await makeUser("admin", { role: "ADMIN", approvedAt: new Date() });
    expect(admin.id).toBeTruthy();

    await pendingApprovalsDigest();

    expect(deliverToMany).toHaveBeenCalledTimes(1);
    const [rows, content, , options] = deliverToMany.mock.calls[0] as unknown as [
      Array<{ id: string }>,
      string,
      number,
      { subject?: string },
    ];

    expect(content).toContain("3 people are waiting");
    expect(content).toContain("Students: 2");
    expect(content).toContain("Applied as teacher: 1");
    expect(options.subject).toBe("3 waiting for approval on AlphaSeekers");
    // Every admin can approve, so the nudge must not go to super admins only.
    expect(rows.some((r) => r.id === admin.id)).toBe(true);
  });

  it("uses singular wording for one person", async () => {
    await makeUser("only", { approvedAt: null });
    await makeUser("admin2", { role: "ADMIN", approvedAt: new Date() });

    await pendingApprovalsDigest();

    const [, content] = deliverToMany.mock.calls[0] as unknown as [unknown, string];
    expect(content).toContain("1 person is waiting");
  });

  it("ignores deactivated accounts so a disabled signup cannot nag forever", async () => {
    await makeUser("ghost", { approvedAt: null, deactivatedAt: new Date() });
    await makeUser("admin3", { role: "ADMIN", approvedAt: new Date() });

    await pendingApprovalsDigest();

    expect(deliverToMany).not.toHaveBeenCalled();
  });

  it("reports teacher applicants who were auto-approved as students", async () => {
    // Registration approves everyone, so these never count as "pending" — the
    // digest used to stay silent while they waited indefinitely.
    await makeUser("applicant1", { approvedAt: new Date(), requestedRole: "TEACHER" });
    await makeUser("applicant2", { approvedAt: new Date(), requestedRole: "TEACHER" });
    // Already granted: no longer a request.
    await makeUser("granted", { role: "TEACHER", approvedAt: new Date(), requestedRole: "TEACHER" });
    // Deactivated: not waiting on anyone.
    await makeUser("gone", { approvedAt: new Date(), requestedRole: "TEACHER", deactivatedAt: new Date() });
    await makeUser("admin4", { role: "ADMIN", approvedAt: new Date() });

    await pendingApprovalsDigest();

    expect(deliverToMany).toHaveBeenCalledTimes(1);
    const [, content, , options] = deliverToMany.mock.calls[0] as unknown as [
      unknown,
      string,
      number,
      { subject?: string },
    ];
    expect(content).toContain("2 people have applied to teach and are still students.");
    expect(content).toContain("Teacher requests");
    expect(content).not.toContain("waiting for platform approval");
    expect(options.subject).toBe("2 waiting for approval on AlphaSeekers");
  });

  it("does not count an unapproved teacher applicant twice", async () => {
    await makeUser("both", { approvedAt: null, requestedRole: "TEACHER" });
    await makeUser("admin5", { role: "ADMIN", approvedAt: new Date() });

    await pendingApprovalsDigest();

    const [, content, , options] = deliverToMany.mock.calls[0] as unknown as [unknown, string, number, { subject?: string }];
    expect(content).toContain("Applied as teacher: 1");
    expect(content).not.toContain("applied to teach and");
    expect(options.subject).toBe("1 waiting for approval on AlphaSeekers");
  });
});
