-- Growth funnel phase 2: saved scores (leads with consent), claims, and module 1 grants.
ALTER TABLE "GrowthGuestPlay" ADD COLUMN "traineeId" TEXT, ADD COLUMN "claimedAt" TIMESTAMP(3);
CREATE INDEX "GrowthGuestPlay_traineeId_idx" ON "GrowthGuestPlay"("traineeId");

CREATE TABLE "GrowthLead" (
  "id" TEXT NOT NULL,
  "playId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "consentAt" TIMESTAMP(3) NOT NULL,
  "consentText" TEXT NOT NULL,
  "optOutToken" TEXT NOT NULL,
  "optedOutAt" TIMESTAMP(3),
  "traineeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrowthLead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrowthLead_playId_key" ON "GrowthLead"("playId");
CREATE UNIQUE INDEX "GrowthLead_optOutToken_key" ON "GrowthLead"("optOutToken");
CREATE INDEX "GrowthLead_campaignId_createdAt_idx" ON "GrowthLead"("campaignId", "createdAt");
CREATE INDEX "GrowthLead_phone_idx" ON "GrowthLead"("phone");
ALTER TABLE "GrowthLead" ADD CONSTRAINT "GrowthLead_playId_fkey" FOREIGN KEY ("playId") REFERENCES "GrowthGuestPlay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GrowthGrant" (
  "id" TEXT NOT NULL,
  "traineeId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "modules" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrowthGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrowthGrant_traineeId_courseId_key" ON "GrowthGrant"("traineeId", "courseId");
CREATE INDEX "GrowthGrant_campaignId_idx" ON "GrowthGrant"("campaignId");
