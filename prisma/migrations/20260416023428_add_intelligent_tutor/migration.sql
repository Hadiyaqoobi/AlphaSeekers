-- AlterTable (preserve embedding vector column — managed via raw SQL)
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "classId" TEXT;

-- CreateTable
CREATE TABLE "CachedResponse" (
    "id" TEXT NOT NULL,
    "questionHash" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionLang" TEXT NOT NULL DEFAULT 'en',
    "answer" TEXT NOT NULL,
    "sources" TEXT,
    "provider" TEXT NOT NULL,
    "quality" DOUBLE PRECISION,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CachedResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInteraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "query" TEXT NOT NULL,
    "answer" TEXT,
    "sources" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'study',
    "topics" TEXT,
    "rating" TEXT,
    "provider" TEXT,
    "classIds" TEXT,
    "responseMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CachedResponse_questionHash_key" ON "CachedResponse"("questionHash");

-- CreateIndex
CREATE INDEX "AIInteraction_userId_createdAt_idx" ON "AIInteraction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIInteraction_mode_createdAt_idx" ON "AIInteraction"("mode", "createdAt");

-- CreateIndex
CREATE INDEX "AIConversation_userId_sessionId_idx" ON "AIConversation"("userId", "sessionId");

-- CreateIndex
CREATE INDEX "DocumentChunk_classId_idx" ON "DocumentChunk"("classId");

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInteraction" ADD CONSTRAINT "AIInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
