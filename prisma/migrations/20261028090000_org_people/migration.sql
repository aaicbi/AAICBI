-- Each person in a training organization has their own role, and what they do is recorded.
ALTER TABLE "TrainingOrganizationMember" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'EDITOR';
-- Teammates who joined before roles existed could already do everything day to day: they become managers so nothing
-- changes for them. New invitations start as editors.
UPDATE "TrainingOrganizationMember" SET "role" = 'MANAGER';

CREATE TABLE "OrgActivity" (
    "id" TEXT NOT NULL,
    "orgUserId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrgActivity_orgUserId_createdAt_idx" ON "OrgActivity"("orgUserId", "createdAt");
