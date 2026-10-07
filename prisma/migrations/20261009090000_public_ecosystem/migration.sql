-- CreateEnum
CREATE TYPE "EducationPostStatus" AS ENUM ('AWAITING_CONSENT', 'DECLINED', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'REMOVED');

-- AlterTable
ALTER TABLE "Trainee" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "ecosystemEducationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ecosystemOrgPagesEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TrainingOrganization" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OrganizationPublicProfile" (
    "id" TEXT NOT NULL,
    "trainingOrganizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "location" TEXT,
    "coverUrl" TEXT,
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPublicProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationPost" (
    "id" TEXT NOT NULL,
    "trainingOrganizationId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "youtubeUrl" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "category" TEXT,
    "topic" TEXT,
    "moduleName" TEXT,
    "status" "EducationPostStatus" NOT NULL DEFAULT 'AWAITING_CONSENT',
    "consentRespondedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducationPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationPostSkill" (
    "postId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "EducationPostSkill_pkey" PRIMARY KEY ("postId","skillId")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPublicProfile_trainingOrganizationId_key" ON "OrganizationPublicProfile"("trainingOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPublicProfile_slug_key" ON "OrganizationPublicProfile"("slug");

-- CreateIndex
CREATE INDEX "EducationPost_trainingOrganizationId_status_idx" ON "EducationPost"("trainingOrganizationId", "status");

-- CreateIndex
CREATE INDEX "EducationPost_traineeId_status_idx" ON "EducationPost"("traineeId", "status");

-- CreateIndex
CREATE INDEX "EducationPost_status_publishedAt_idx" ON "EducationPost"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "EducationPostSkill_skillId_idx" ON "EducationPostSkill"("skillId");

-- AddForeignKey
ALTER TABLE "OrganizationPublicProfile" ADD CONSTRAINT "OrganizationPublicProfile_trainingOrganizationId_fkey" FOREIGN KEY ("trainingOrganizationId") REFERENCES "TrainingOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationPost" ADD CONSTRAINT "EducationPost_trainingOrganizationId_fkey" FOREIGN KEY ("trainingOrganizationId") REFERENCES "TrainingOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationPost" ADD CONSTRAINT "EducationPost_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationPost" ADD CONSTRAINT "EducationPost_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationPostSkill" ADD CONSTRAINT "EducationPostSkill_postId_fkey" FOREIGN KEY ("postId") REFERENCES "EducationPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationPostSkill" ADD CONSTRAINT "EducationPostSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

