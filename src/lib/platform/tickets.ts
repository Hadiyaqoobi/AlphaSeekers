import { Prisma, TicketPriority, TicketStatus, TicketType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type TicketListFilters = {
  status?: TicketStatus | "ALL";
  type?: TicketType | "ALL";
};

const listSelect = {
  id: true,
  title: true,
  type: true,
  priority: true,
  status: true,
  area: true,
  createdAt: true,
  resolvedAt: true,
  reporter: { select: { id: true, name: true, email: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TicketSelect;

/**
 * Newest first, because the queue is read as "what came in since I last
 * looked". Bounded so one runaway reporter cannot make the page unbounded.
 */
export async function listTickets(filters: TicketListFilters = {}, limit = 200) {
  const where: Prisma.TicketWhereInput = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.type && filters.type !== "ALL") where.type = filters.type;

  const rows = await prisma.ticket.findMany({
    where,
    select: listSelect,
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  });

  return rows.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
    commentCount: t._count.comments,
  }));
}

export async function getTicketById(ticketId: string) {
  const t = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!t) return null;

  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
    comments: t.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: c.author,
    })),
  };
}

export async function createTicket(input: {
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
  area?: string | null;
  attachmentUrl?: string | null;
  reporterId: string;
}) {
  return prisma.ticket.create({
    data: {
      title: input.title,
      description: input.description,
      type: input.type,
      priority: input.priority,
      area: input.area ?? null,
      attachmentUrl: input.attachmentUrl ?? null,
      reporterId: input.reporterId,
    },
    include: { reporter: { select: { id: true, name: true, email: true } } },
  });
}

/**
 * Status changes stamp resolvedAt so "how long did this sit open" is
 * answerable later. Moving a ticket back out of a terminal state clears it
 * again rather than leaving a stale timestamp behind.
 */
export async function setTicketStatus(ticketId: string, status: TicketStatus) {
  const existing = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true },
  });
  if (!existing) return null;

  const terminal = status === TicketStatus.DONE || status === TicketStatus.WONT_DO;

  return prisma.ticket.update({
    where: { id: ticketId },
    data: { status, resolvedAt: terminal ? new Date() : null },
    select: { id: true, status: true, resolvedAt: true },
  });
}

export async function addTicketComment(ticketId: string, authorId: string, body: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!ticket) return null;

  const comment = await prisma.ticketComment.create({
    data: { ticketId, authorId, body },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  // A reply is activity on the ticket; keep updatedAt meaningful for sorting
  // and for "nothing has moved on this in a week" checks.
  await prisma.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });

  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    author: comment.author,
  };
}

/** Counts for the review sweep: what is open, and what is urgent-and-open. */
export async function getTicketCounts() {
  const [open, inProgress, urgentOpen] = await Promise.all([
    prisma.ticket.count({ where: { status: TicketStatus.OPEN } }),
    prisma.ticket.count({ where: { status: TicketStatus.IN_PROGRESS } }),
    prisma.ticket.count({
      where: {
        status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
        priority: TicketPriority.URGENT,
      },
    }),
  ]);
  return { open, inProgress, urgentOpen };
}
