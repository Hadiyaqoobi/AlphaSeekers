-- Course access becomes a request an admin grants, rather than something every
-- platform-approved student can help themselves to.
ALTER TYPE "EnrollmentStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "EnrollmentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
