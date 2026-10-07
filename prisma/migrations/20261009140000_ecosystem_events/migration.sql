-- CreateEnum
CREATE TYPE "EcosystemEventType" AS ENUM ('PROFILE_VIEW', 'VIDEO_VIEW', 'PROGRAM_CLICK');

-- CreateTable
CREATE TABLE "EcosystemEvent" (
    "id" TEXT NOT NULL,
    "type" "EcosystemEventType" NOT NULL,
    "trainingOrganizationId" TEXT NOT NULL,
    "postId" TEXT,
    "courseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcosystemEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcosystemEvent_trainingOrganizationId_type_createdAt_idx" ON "EcosystemEvent"("trainingOrganizationId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "EcosystemEvent_type_createdAt_idx" ON "EcosystemEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "EcosystemEvent" ADD CONSTRAINT "EcosystemEvent_trainingOrganizationId_fkey" FOREIGN KEY ("trainingOrganizationId") REFERENCES "TrainingOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

