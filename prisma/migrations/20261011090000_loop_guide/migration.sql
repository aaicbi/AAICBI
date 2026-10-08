-- CreateEnum
CREATE TYPE "GuideQuestionStatus" AS ENUM ('OPEN', 'ANSWERED', 'DISMISSED');

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN "guideEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "GuideEntry" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "links" JSONB NOT NULL DEFAULT '[]',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuideUnanswered" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "asked" INTEGER NOT NULL DEFAULT 1,
    "status" "GuideQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "firstAskedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAskedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryId" TEXT,

    CONSTRAINT "GuideUnanswered_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuideEntry_enabled_idx" ON "GuideEntry"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "GuideUnanswered_text_key" ON "GuideUnanswered"("text");

-- CreateIndex
CREATE INDEX "GuideUnanswered_status_lastAskedAt_idx" ON "GuideUnanswered"("status", "lastAskedAt");
