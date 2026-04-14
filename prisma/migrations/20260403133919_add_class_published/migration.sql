-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationChannel" ADD VALUE 'TELEGRAM';
ALTER TYPE "NotificationChannel" ADD VALUE 'WEB_PUSH';

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "registrationFormUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationPrefs" TEXT,
ADD COLUMN     "pushSubscription" TEXT,
ADD COLUMN     "telegramChatId" TEXT;
