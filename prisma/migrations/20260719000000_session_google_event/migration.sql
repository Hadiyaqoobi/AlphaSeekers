-- Track the Google Calendar event backing a session's Meet link, so reschedules
-- can PATCH the same event (preserving the link) and cancels can delete it.
-- Additive; safe to re-apply.

ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "googleCalendarId" TEXT;
