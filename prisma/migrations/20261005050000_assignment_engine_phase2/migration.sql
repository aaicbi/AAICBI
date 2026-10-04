-- AI Assignment Engine, Phase 2 — resubmission-history support fields,
-- cross-assignment AI learning insights, and due-date reminder dedup.

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN "failedQuestionThresholdPercent" INTEGER NOT NULL DEFAULT 50;

-- CreateTable
CREATE TABLE "AssignmentLearningInsight" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "strengths" JSONB NOT NULL,
    "weaknesses" JSONB NOT NULL,
    "narrative" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentLearningInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentReminderSent" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentReminderSent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentLearningInsight_traineeId_key" ON "AssignmentLearningInsight"("traineeId");
CREATE UNIQUE INDEX "AssignmentReminderSent_assignmentId_traineeId_type_key" ON "AssignmentReminderSent"("assignmentId", "traineeId", "type");

-- AddForeignKey
ALTER TABLE "AssignmentLearningInsight" ADD CONSTRAINT "AssignmentLearningInsight_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentReminderSent" ADD CONSTRAINT "AssignmentReminderSent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentReminderSent" ADD CONSTRAINT "AssignmentReminderSent_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
