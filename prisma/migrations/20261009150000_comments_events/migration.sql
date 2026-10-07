-- CreateEnum
CREATE TYPE "EducationCommentStatus" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "OrganizationEventStatus" AS ENUM ('PUBLISHED', 'REMOVED');

-- CreateTable
CREATE TABLE "EducationPostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "EducationCommentStatus" NOT NULL DEFAULT 'VISIBLE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EducationPostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationEvent" (
    "id" TEXT NOT NULL,
    "trainingOrganizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "locationText" TEXT,
    "registrationUrl" TEXT,
    "status" "OrganizationEventStatus" NOT NULL DEFAULT 'PUBLISHED',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EducationPostComment_postId_status_createdAt_idx" ON "EducationPostComment"("postId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "EducationPostComment_traineeId_idx" ON "EducationPostComment"("traineeId");

-- CreateIndex
CREATE INDEX "OrganizationEvent_trainingOrganizationId_startsAt_idx" ON "OrganizationEvent"("trainingOrganizationId", "startsAt");

-- CreateIndex
CREATE INDEX "OrganizationEvent_status_startsAt_idx" ON "OrganizationEvent"("status", "startsAt");

-- AddForeignKey
ALTER TABLE "EducationPostComment" ADD CONSTRAINT "EducationPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "EducationPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationPostComment" ADD CONSTRAINT "EducationPostComment_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationEvent" ADD CONSTRAINT "OrganizationEvent_trainingOrganizationId_fkey" FOREIGN KEY ("trainingOrganizationId") REFERENCES "TrainingOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

