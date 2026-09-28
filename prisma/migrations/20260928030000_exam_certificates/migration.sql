-- Standalone-exam certificates: admin-toggleable per exam, issued when
-- a trainee passes. Separate table from Certificate on purpose (see
-- ExamCertificate's own schema comment).
ALTER TABLE "Exam" ADD COLUMN "certificateEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ExamCertificate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "examAttemptId" TEXT NOT NULL,

    CONSTRAINT "ExamCertificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamCertificate_code_key" ON "ExamCertificate"("code");
CREATE UNIQUE INDEX "ExamCertificate_examAttemptId_key" ON "ExamCertificate"("examAttemptId");
CREATE UNIQUE INDEX "ExamCertificate_traineeId_examId_key" ON "ExamCertificate"("traineeId", "examId");
CREATE INDEX "ExamCertificate_traineeId_idx" ON "ExamCertificate"("traineeId");

ALTER TABLE "ExamCertificate" ADD CONSTRAINT "ExamCertificate_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamCertificate" ADD CONSTRAINT "ExamCertificate_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamCertificate" ADD CONSTRAINT "ExamCertificate_examAttemptId_fkey" FOREIGN KEY ("examAttemptId") REFERENCES "Attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
