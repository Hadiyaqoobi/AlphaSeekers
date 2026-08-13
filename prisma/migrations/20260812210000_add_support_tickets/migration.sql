-- Internal support tickets: the admin team reports bugs, requests features and
-- asks questions here instead of emailing, and the thread stays on the record.

CREATE TYPE "TicketType" AS ENUM ('BUG', 'FEATURE', 'QUESTION');
CREATE TYPE "TicketPriority" AS ENUM ('NORMAL', 'URGENT');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'WONT_DO');

CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "TicketType" NOT NULL DEFAULT 'BUG',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "area" TEXT,
    "attachmentUrl" TEXT,
    "reporterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Ticket_status_createdAt_idx" ON "Ticket"("status", "createdAt");
CREATE INDEX "Ticket_type_createdAt_idx" ON "Ticket"("type", "createdAt");
CREATE INDEX "Ticket_reporterId_createdAt_idx" ON "Ticket"("reporterId", "createdAt");
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");
CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON "TicketComment"("ticketId", "createdAt");

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
