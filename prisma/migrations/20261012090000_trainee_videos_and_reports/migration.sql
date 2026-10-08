-- AlterEnum
ALTER TYPE "EducationPostStatus" ADD VALUE 'AWAITING_ORG';
ALTER TYPE "EducationPostStatus" ADD VALUE 'ORG_DECLINED';

-- AlterTable
ALTER TABLE "EducationPost" ADD COLUMN "submittedByTrainee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "orgDecidedAt" TIMESTAMP(3),
ADD COLUMN "orgDecisionNote" TEXT,
ADD COLUMN "escalatedAt" TIMESTAMP(3),
ADD COLUMN "escalationNote" TEXT;

-- CreateEnum
CREATE TYPE "OrganizationReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "OrganizationReport" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "trainingOrganizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" "OrganizationReportStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "handledById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationReport_status_createdAt_idx" ON "OrganizationReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OrganizationReport_trainingOrganizationId_idx" ON "OrganizationReport"("trainingOrganizationId");

-- CreateIndex
CREATE INDEX "OrganizationReport_traineeId_idx" ON "OrganizationReport"("traineeId");

-- AddForeignKey
ALTER TABLE "OrganizationReport" ADD CONSTRAINT "OrganizationReport_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationReport" ADD CONSTRAINT "OrganizationReport_trainingOrganizationId_fkey" FOREIGN KEY ("trainingOrganizationId") REFERENCES "TrainingOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
