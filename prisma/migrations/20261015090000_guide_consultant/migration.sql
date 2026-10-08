-- Claude consultant for the guide's knowledge: a switch (off by default) and a table of advice awaiting a super admin's decision.

ALTER TABLE "PlatformSettings" ADD COLUMN "guideConsultantEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "GuideSuggestion" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "questionId" TEXT,
  "entryId" TEXT,
  "title" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "proposal" JSONB NOT NULL DEFAULT '{}',
  "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "model" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "decidedById" TEXT,
  CONSTRAINT "GuideSuggestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuideSuggestion_status_createdAt_idx" ON "GuideSuggestion"("status", "createdAt");
CREATE INDEX "GuideSuggestion_questionId_idx" ON "GuideSuggestion"("questionId");
