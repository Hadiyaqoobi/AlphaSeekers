-- AlphaSeekers publishes a WhatsApp channel, which had no Site Settings field.
ALTER TABLE "SiteSettings" ADD COLUMN "whatsappUrl" TEXT;
