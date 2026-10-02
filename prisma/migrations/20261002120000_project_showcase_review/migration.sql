-- Community Showcase moderation — Project.listedInShowcase used to be
-- instant-publish with no review step at all. Adds the same
-- approve/reject shape JobPosting already uses (status enum +
-- reviewedById/reviewedAt) plus a child media table, same shape as
-- JobPostingMedia.

-- CreateEnum
CREATE TYPE "ProjectShowcaseStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProjectMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "showcaseStatus" "ProjectShowcaseStatus" NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE "Project" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "Project" ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Project_showcaseStatus_idx" ON "Project"("showcaseStatus");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ProjectMedia" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ProjectMediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectMedia_projectId_idx" ON "ProjectMedia"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectMedia" ADD CONSTRAINT "ProjectMedia_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
