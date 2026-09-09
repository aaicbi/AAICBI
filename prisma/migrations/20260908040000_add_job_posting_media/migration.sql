-- CreateEnum
CREATE TYPE "JobPostingMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "JobPostingMedia" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "type" "JobPostingMediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPostingMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobPostingMedia_jobPostingId_idx" ON "JobPostingMedia"("jobPostingId");

-- AddForeignKey
ALTER TABLE "JobPostingMedia" ADD CONSTRAINT "JobPostingMedia_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

