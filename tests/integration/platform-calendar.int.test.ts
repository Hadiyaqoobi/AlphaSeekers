/**
 * Which Google account creates Meet links for teachers who have not connected
 * their own (GOOGLE_CALENDAR_OWNER_EMAIL), against a REAL Postgres.
 *
 * Production names the GOOGLE account (alphaseekers2026@gmail.com), which is
 * connected under an admin login with a different email. Only the login was
 * matched, so the shared account was never found and Meet links stayed PENDING.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { getPlatformCalendarLink } from "@/lib/integrations/meet";
import { prisma } from "@/lib/prisma";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "platcal";
const email = (s: string) => `${TAG}+${s}@example.com`;
const ORIGINAL = process.env.GOOGLE_CALENDAR_OWNER_EMAIL;

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${TAG}+` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.googleAccountLink.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function adminWithGoogle(slug: string, googleEmail: string, refreshToken = "enc-token") {
  const admin = await prisma.user.create({
    data: { name: `${TAG} ${slug}`, email: email(slug), role: "ADMIN", approvedAt: new Date() },
    select: { id: true, email: true },
  });
  const link = await prisma.googleAccountLink.create({
    data: { userId: admin.id, googleEmail, refreshToken },
    select: { id: true },
  });
  return { admin, link };
}

d("shared Google calendar account", () => {
  beforeEach(cleanup);
  afterEach(() => {
    process.env.GOOGLE_CALENDAR_OWNER_EMAIL = ORIGINAL;
  });
  afterAll(cleanup);

  it("is found by the Google address, even when connected under a different login", async () => {
    const { link } = await adminWithGoogle("owner", `${TAG}-calendar@gmail.com`);
    process.env.GOOGLE_CALENDAR_OWNER_EMAIL = ` ${TAG.toUpperCase()}-Calendar@Gmail.com `;

    expect((await getPlatformCalendarLink())?.id).toBe(link.id);
  });

  it("is still found by the AlphaSeekers login that connected it", async () => {
    const { admin, link } = await adminWithGoogle("login", `${TAG}-other@gmail.com`);
    process.env.GOOGLE_CALENDAR_OWNER_EMAIL = admin.email;

    expect((await getPlatformCalendarLink())?.id).toBe(link.id);
  });

  it("finds nothing for an unknown address, an unset variable, or a link without a token", async () => {
    await adminWithGoogle("notoken", `${TAG}-notoken@gmail.com`, "");

    process.env.GOOGLE_CALENDAR_OWNER_EMAIL = `${TAG}-nobody@gmail.com`;
    expect(await getPlatformCalendarLink()).toBeNull();

    process.env.GOOGLE_CALENDAR_OWNER_EMAIL = `${TAG}-notoken@gmail.com`;
    expect(await getPlatformCalendarLink()).toBeNull();

    delete process.env.GOOGLE_CALENDAR_OWNER_EMAIL;
    expect(await getPlatformCalendarLink()).toBeNull();
  });
});
