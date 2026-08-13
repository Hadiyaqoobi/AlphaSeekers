/**
 * Integration tests for the internal support-ticket queue against a REAL Postgres.
 *
 * The queue exists to replace the email loop the admin team was stuck in, so the
 * behaviours worth pinning are the ones that would quietly send them back to
 * Gmail: tickets going missing from filters, replies not attaching, and
 * resolved/reopened state drifting.
 *
 * Runs only when DATABASE_URL points at a disposable test database.
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  addTicketComment,
  createTicket,
  getTicketById,
  getTicketCounts,
  listTickets,
  setTicketStatus,
} from "@/lib/platform/tickets";
import {
  MAX_ATTACHMENT_BYTES,
  getAttachment,
  saveAttachment,
  validateAttachment,
} from "@/lib/platform/ticket-attachments";

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngBytes = (payload = "screenshot") => Buffer.concat([PNG_HEADER, Buffer.from(payload)]);

const shouldRun = process.env.RUN_DB_TESTS === "1";
const TAG = "tickettest";
const email = (s: string) => `${TAG}+${s}@example.com`;

const d = shouldRun ? describe : describe.skip;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${TAG}+` } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.ticketComment.deleteMany({ where: { authorId: { in: ids } } });
    await prisma.ticketAttachment.deleteMany({ where: { ticket: { reporterId: { in: ids } } } });
    await prisma.ticket.deleteMany({ where: { reporterId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function makeUser(slug: string) {
  return prisma.user.create({
    data: { name: `${TAG} ${slug}`, email: email(slug), role: "ADMIN", approvedAt: new Date() },
    select: { id: true },
  });
}

async function makeTicket(reporterId: string, over: Partial<Parameters<typeof createTicket>[0]> = {}) {
  return createTicket({
    title: `${TAG} something is broken`,
    description: "Steps: open the page, click the button, nothing happens.",
    type: "BUG",
    priority: "NORMAL",
    reporterId,
    ...over,
  });
}

d("support tickets", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("files a ticket and returns it in the open queue with its reporter", async () => {
    const user = await makeUser("reporter");
    const ticket = await makeTicket(user.id, { title: `${TAG} lecturer dropdown is empty` });

    const open = await listTickets({ status: "OPEN" });
    const found = open.find((t) => t.id === ticket.id);

    expect(found).toBeDefined();
    expect(found?.reporter.id).toBe(user.id);
    expect(found?.commentCount).toBe(0);
  });

  it("filters by status and type independently", async () => {
    const user = await makeUser("filters");
    const bug = await makeTicket(user.id, { type: "BUG" });
    const feature = await makeTicket(user.id, { type: "FEATURE" });

    const bugs = await listTickets({ type: "BUG" });
    expect(bugs.some((t) => t.id === bug.id)).toBe(true);
    expect(bugs.some((t) => t.id === feature.id)).toBe(false);

    const features = await listTickets({ type: "FEATURE" });
    expect(features.some((t) => t.id === feature.id)).toBe(true);

    // A ticket that has been closed must leave the default OPEN view, or the
    // queue never drains and the team stops trusting it.
    await setTicketStatus(bug.id, "DONE");
    const stillOpen = await listTickets({ status: "OPEN" });
    expect(stillOpen.some((t) => t.id === bug.id)).toBe(false);
  });

  it("stamps resolvedAt on close and clears it when reopened", async () => {
    const user = await makeUser("resolve");
    const ticket = await makeTicket(user.id);

    const done = await setTicketStatus(ticket.id, "DONE");
    expect(done?.status).toBe("DONE");
    expect(done?.resolvedAt).not.toBeNull();

    // Regression guard: reopening must not leave a stale resolution date behind,
    // which would make "how long was this open" nonsense.
    const reopened = await setTicketStatus(ticket.id, "IN_PROGRESS");
    expect(reopened?.status).toBe("IN_PROGRESS");
    expect(reopened?.resolvedAt).toBeNull();
  });

  it("attaches replies to the ticket in order", async () => {
    const reporter = await makeUser("thread-reporter");
    const responder = await makeUser("thread-responder");
    const ticket = await makeTicket(reporter.id);

    await addTicketComment(ticket.id, reporter.id, "It happens every time I open the page.");
    await addTicketComment(ticket.id, responder.id, "Fixed and deployed — please confirm.");

    const full = await getTicketById(ticket.id);
    expect(full?.comments).toHaveLength(2);
    expect(full?.comments[0].author.id).toBe(reporter.id);
    expect(full?.comments[1].author.id).toBe(responder.id);
  });

  it("reports NOT_FOUND rather than throwing for a ticket that does not exist", async () => {
    expect(await getTicketById("does-not-exist")).toBeNull();
    expect(await setTicketStatus("does-not-exist", "DONE")).toBeNull();
    expect(await addTicketComment("does-not-exist", "nobody", "hi")).toBeNull();
  });

  it("rejects anything that is not really an image, whatever the browser claims", async () => {
    // A renamed script that declares image/png must not get through: these bytes
    // are served back to admins from our own origin.
    expect(validateAttachment(Buffer.from("<script>alert(1)</script>"), "image/png")).toEqual({
      ok: false,
      reason: "NOT_AN_IMAGE",
    });
    // SVG is excluded on purpose -- it is XML that can carry script.
    expect(validateAttachment(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/svg+xml")).toEqual({
      ok: false,
      reason: "UNSUPPORTED_TYPE",
    });
    expect(validateAttachment(Buffer.alloc(MAX_ATTACHMENT_BYTES + 1), "image/png")).toEqual({
      ok: false,
      reason: "TOO_LARGE",
    });
    expect(validateAttachment(Buffer.alloc(0), "image/png")).toEqual({ ok: false, reason: "TOO_LARGE" });
    expect(validateAttachment(pngBytes(), "image/png")).toEqual({ ok: true, contentType: "image/png" });
  });

  it("stores one screenshot per ticket and replaces it on re-upload", async () => {
    const user = await makeUser("attach");
    const ticket = await makeTicket(user.id);

    await saveAttachment({ ticketId: ticket.id, filename: "first.png", contentType: "image/png", bytes: pngBytes("one") });
    const second = pngBytes("two-is-longer");
    await saveAttachment({ ticketId: ticket.id, filename: "second.png", contentType: "image/png", bytes: second });

    const stored = await getAttachment(ticket.id);
    expect(stored?.filename).toBe("second.png");
    expect(stored?.size).toBe(second.length);
    expect(await prisma.ticketAttachment.count({ where: { ticketId: ticket.id } })).toBe(1);

    // Deleting the ticket must not orphan megabytes of image data.
    await prisma.ticket.delete({ where: { id: ticket.id } });
    expect(await prisma.ticketAttachment.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  it("never pulls image bytes into the ticket detail payload", async () => {
    const user = await makeUser("attach-meta");
    const ticket = await makeTicket(user.id);
    await saveAttachment({ ticketId: ticket.id, filename: "s.png", contentType: "image/png", bytes: pngBytes() });

    const full = await getTicketById(ticket.id);
    expect(full?.attachment?.filename).toBe("s.png");
    // Regression guard: including `data` here would ship the whole image
    // through the server component on every page render.
    expect((full?.attachment as Record<string, unknown> | null | undefined)?.data).toBeUndefined();
  });

  it("counts urgent work that is still open", async () => {
    const user = await makeUser("counts");
    const urgent = await makeTicket(user.id, { priority: "URGENT" });

    const before = await getTicketCounts();
    expect(before.urgentOpen).toBeGreaterThan(0);

    // Closing the urgent ticket must drop it out of the urgent-open count,
    // otherwise the review sweep keeps flagging work that is already finished.
    await setTicketStatus(urgent.id, "DONE");
    const after = await getTicketCounts();
    expect(after.urgentOpen).toBe(before.urgentOpen - 1);
  });
});
