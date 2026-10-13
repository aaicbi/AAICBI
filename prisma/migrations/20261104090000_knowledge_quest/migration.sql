-- CreateEnum
CREATE TYPE "QuestionPool" AS ENUM ('PRACTICE', 'FORMAL');

-- CreateEnum
CREATE TYPE "XpKind" AS ENUM ('ANSWER', 'MISSED_BONUS', 'STREAK', 'OBJECTIVE_MASTERED', 'MODULE_COMPLETED');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "bankPool" "QuestionPool";

-- AlterTable
ALTER TABLE "ModuleLearningObjective" ADD COLUMN     "isCritical" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ModuleQuestSettings" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "practiceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "practiceBeforeFormal" BOOLEAN NOT NULL DEFAULT false,
    "practiceRequiredPercent" INTEGER NOT NULL DEFAULT 70,
    "enabledRewards" TEXT[] DEFAULT ARRAY['ANSWER', 'MISSED_BONUS', 'STREAK', 'OBJECTIVE_MASTERED', 'MODULE_COMPLETED']::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleQuestSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeAnswer" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "selectedOptionKey" TEXT,
    "correct" BOOLEAN,
    "secondsTaken" INTEGER,
    "tooFast" BOOLEAN NOT NULL DEFAULT false,
    "hintUsed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PracticeAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpEntry" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "kind" "XpKind" NOT NULL,
    "points" INTEGER NOT NULL,
    "objectiveId" TEXT,
    "questionId" TEXT,
    "dayKey" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormalUnlock" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormalUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModuleQuestSettings_moduleId_key" ON "ModuleQuestSettings"("moduleId");

-- CreateIndex
CREATE INDEX "PracticeAnswer_traineeId_objectiveId_answeredAt_idx" ON "PracticeAnswer"("traineeId", "objectiveId", "answeredAt");

-- CreateIndex
CREATE INDEX "PracticeAnswer_traineeId_questionId_idx" ON "PracticeAnswer"("traineeId", "questionId");

-- CreateIndex
CREATE INDEX "PracticeAnswer_traineeId_moduleId_answeredAt_idx" ON "PracticeAnswer"("traineeId", "moduleId", "answeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "XpEntry_dedupeKey_key" ON "XpEntry"("dedupeKey");

-- CreateIndex
CREATE INDEX "XpEntry_traineeId_moduleId_idx" ON "XpEntry"("traineeId", "moduleId");

-- CreateIndex
CREATE INDEX "XpEntry_traineeId_dayKey_idx" ON "XpEntry"("traineeId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "FormalUnlock_traineeId_moduleId_key" ON "FormalUnlock"("traineeId", "moduleId");

-- AddForeignKey
ALTER TABLE "ModuleQuestSettings" ADD CONSTRAINT "ModuleQuestSettings_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAnswer" ADD CONSTRAINT "PracticeAnswer_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAnswer" ADD CONSTRAINT "PracticeAnswer_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAnswer" ADD CONSTRAINT "PracticeAnswer_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "ModuleLearningObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAnswer" ADD CONSTRAINT "PracticeAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEntry" ADD CONSTRAINT "XpEntry_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEntry" ADD CONSTRAINT "XpEntry_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormalUnlock" ADD CONSTRAINT "FormalUnlock_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormalUnlock" ADD CONSTRAINT "FormalUnlock_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

