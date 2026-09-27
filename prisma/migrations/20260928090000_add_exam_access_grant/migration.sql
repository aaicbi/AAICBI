-- Standalone-exam access control: only a trainee explicitly granted
-- access (by a Super Admin) can see or start an Exam that isn't part
-- of any course, mirroring how an UNLISTED course requires a real
-- CourseEnrollment rather than being reachable by anyone with the URL.
CREATE TABLE "ExamAccessGrant" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ExamAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamAccessGrant_examId_traineeId_key" ON "ExamAccessGrant"("examId", "traineeId");
CREATE INDEX "ExamAccessGrant_traineeId_idx" ON "ExamAccessGrant"("traineeId");

ALTER TABLE "ExamAccessGrant" ADD CONSTRAINT "ExamAccessGrant_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamAccessGrant" ADD CONSTRAINT "ExamAccessGrant_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamAccessGrant" ADD CONSTRAINT "ExamAccessGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
