-- CreateEnum
CREATE TYPE "QuestionBankStatus" AS ENUM ('PENDING_REVIEW', 'PENDING_VALIDATION', 'VALIDATED_PASS', 'VALIDATED_WARNING', 'VALIDATED_FLAGGED', 'VALIDATED_REJECTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "bankObjectiveId" TEXT,
ADD COLUMN     "bankStatus" "QuestionBankStatus";

-- CreateTable
CREATE TABLE "ModuleLearningObjective" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "confirmedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleLearningObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSourceMaterial" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,

    CONSTRAINT "QuestionSourceMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionBankEvent" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "fromStatus" "QuestionBankStatus",
    "toStatus" "QuestionBankStatus" NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "detail" JSONB,
    "actedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionBankEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModuleLearningObjective_moduleId_idx" ON "ModuleLearningObjective"("moduleId");

-- CreateIndex
CREATE INDEX "QuestionSourceMaterial_materialId_idx" ON "QuestionSourceMaterial"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionSourceMaterial_questionId_materialId_key" ON "QuestionSourceMaterial"("questionId", "materialId");

-- CreateIndex
CREATE INDEX "QuestionBankEvent_questionId_idx" ON "QuestionBankEvent"("questionId");

-- CreateIndex
CREATE INDEX "QuestionBankEvent_createdAt_idx" ON "QuestionBankEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_bankObjectiveId_fkey" FOREIGN KEY ("bankObjectiveId") REFERENCES "ModuleLearningObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleLearningObjective" ADD CONSTRAINT "ModuleLearningObjective_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleLearningObjective" ADD CONSTRAINT "ModuleLearningObjective_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSourceMaterial" ADD CONSTRAINT "QuestionSourceMaterial_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSourceMaterial" ADD CONSTRAINT "QuestionSourceMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankEvent" ADD CONSTRAINT "QuestionBankEvent_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankEvent" ADD CONSTRAINT "QuestionBankEvent_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
