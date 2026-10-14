-- Additive and backward compatible: one defaulted column, two NOT NULL
-- constraints relaxed, two foreign keys re-pointed from CASCADE to SET NULL.
-- Code from before this migration keeps working against the new schema.

-- Job: event-bus jobs give up their dedupeKey once finished (see
-- src/lib/jobs/queue.ts). Existing rows default to the old behaviour.
ALTER TABLE "Job" ADD COLUMN "releaseKeyOnFinish" BOOLEAN NOT NULL DEFAULT false;

-- Ticket.reporter: deleting a user no longer deletes the tickets they filed.
ALTER TABLE "Ticket" ALTER COLUMN "reporterId" DROP NOT NULL;
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_reporterId_fkey";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TicketComment.author: same, for replies.
ALTER TABLE "TicketComment" ALTER COLUMN "authorId" DROP NOT NULL;
ALTER TABLE "TicketComment" DROP CONSTRAINT "TicketComment_authorId_fkey";
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
