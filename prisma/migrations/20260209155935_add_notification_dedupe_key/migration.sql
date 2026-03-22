-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "dedupeKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_channel_key" ON "Notification"("dedupeKey", "channel");
