-- Verifiable certificates issued from a class page. Additive: a new enum and a
-- new table, nothing existing is changed.
CREATE TYPE "CertificateKind" AS ENUM ('STUDENT_COMPLETION', 'TEACHER_RECOGNITION');

CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "CertificateKind" NOT NULL,
    "userId" TEXT,
    "classId" TEXT,
    "recipientName" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "detail" TEXT,
    "hours" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "activeKey" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Certificate_code_key" ON "Certificate"("code");
CREATE UNIQUE INDEX "Certificate_activeKey_key" ON "Certificate"("activeKey");
CREATE INDEX "Certificate_classId_idx" ON "Certificate"("classId");
CREATE INDEX "Certificate_userId_idx" ON "Certificate"("userId");

ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
