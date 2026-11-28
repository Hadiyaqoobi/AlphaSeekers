-- Existing certificates and inserts from the previous app keep their original layout.
BEGIN;
SET LOCAL lock_timeout = '3s';
ALTER TABLE "Certificate" ADD COLUMN "layoutVersion" INTEGER NOT NULL DEFAULT 1;
COMMIT;
