-- CreateTable
CREATE TABLE "GoogleAccountLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "scope" TEXT,
    "expiryDate" TIMESTAMP(3),
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAccountLink_userId_key" ON "GoogleAccountLink"("userId");

-- AddForeignKey
ALTER TABLE "GoogleAccountLink" ADD CONSTRAINT "GoogleAccountLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
