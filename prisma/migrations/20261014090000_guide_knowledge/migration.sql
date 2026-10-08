-- Guide knowledge workflow: approved-answer fields, version history, richer review queue, daily counters.

ALTER TYPE "GuideQuestionStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "GuideQuestionStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "GuideQuestionStatus" ADD VALUE IF NOT EXISTS 'MERGED';

ALTER TABLE "GuideEntry"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "navHref" TEXT,
  ADD COLUMN "navLabel" TEXT,
  ADD COLUMN "target" TEXT,
  ADD COLUMN "relatedQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "updatedById" TEXT,
  ADD COLUMN "served" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "GuideEntry_category_idx" ON "GuideEntry"("category");

CREATE TABLE "GuideEntryVersion" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "links" JSONB NOT NULL DEFAULT '[]',
  "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "category" TEXT,
  "navHref" TEXT,
  "navLabel" TEXT,
  "target" TEXT,
  "relatedQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "changedById" TEXT,
  "changedByName" TEXT,
  "changeNote" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuideEntryVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuideEntryVersion_entryId_version_key" ON "GuideEntryVersion"("entryId", "version");
CREATE INDEX "GuideEntryVersion_changedAt_idx" ON "GuideEntryVersion"("changedAt");
ALTER TABLE "GuideEntryVersion" ADD CONSTRAINT "GuideEntryVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "GuideEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuideUnanswered"
  ADD COLUMN "tokenKey" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "variants" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "reason" TEXT NOT NULL DEFAULT 'NO_MATCH',
  ADD COLUMN "confidence" DOUBLE PRECISION,
  ADD COLUMN "attempted" TEXT,
  ADD COLUMN "roleCounts" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "lastRole" TEXT,
  ADD COLUMN "lastRoute" TEXT,
  ADD COLUMN "lastPage" TEXT,
  ADD COLUMN "feature" TEXT,
  ADD COLUMN "context" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "category" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewNote" TEXT,
  ADD COLUMN "mergedIntoId" TEXT;
CREATE INDEX "GuideUnanswered_tokenKey_idx" ON "GuideUnanswered"("tokenKey");

CREATE TABLE "GuideDailyStat" (
  "id" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "answered" INTEGER NOT NULL DEFAULT 0,
  "unanswered" INTEGER NOT NULL DEFAULT 0,
  "lowConfidence" INTEGER NOT NULL DEFAULT 0,
  "helpful" INTEGER NOT NULL DEFAULT 0,
  "notHelpful" INTEGER NOT NULL DEFAULT 0,
  "navigations" INTEGER NOT NULL DEFAULT 0,
  "tours" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "GuideDailyStat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuideDailyStat_day_role_key" ON "GuideDailyStat"("day", "role");
CREATE INDEX "GuideDailyStat_day_idx" ON "GuideDailyStat"("day");
