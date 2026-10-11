-- The review team: reviewer permission, escalation to the super admin, appeals of organization holds, and a log of decisions.
ALTER TABLE "User" ADD COLUMN "canReview" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Post" ADD COLUMN "escalatedAt" TIMESTAMP(3), ADD COLUMN "escalatedById" TEXT, ADD COLUMN "escalationNote" TEXT, ADD COLUMN "appealedAt" TIMESTAMP(3), ADD COLUMN "appealNote" TEXT;

ALTER TABLE "GuideUnanswered" ADD COLUMN "escalatedAt" TIMESTAMP(3), ADD COLUMN "escalatedById" TEXT, ADD COLUMN "escalationNote" TEXT;

CREATE TABLE "ReviewLog" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReviewLog_kind_itemId_createdAt_idx" ON "ReviewLog"("kind", "itemId", "createdAt");
