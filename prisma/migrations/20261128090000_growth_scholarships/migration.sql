-- Growth funnel: scholarship seats for people who pass module 1.
ALTER TABLE "GrowthCampaign" ADD COLUMN "scholarshipSeats" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GrowthCampaign" ADD COLUMN "scholarshipMinPlays" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "GrowthScholarship" (
  "id" TEXT NOT NULL,
  "traineeId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AWARDED',
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "note" TEXT,
  CONSTRAINT "GrowthScholarship_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrowthScholarship_traineeId_courseId_key" ON "GrowthScholarship"("traineeId", "courseId");
CREATE INDEX "GrowthScholarship_campaignId_status_idx" ON "GrowthScholarship"("campaignId", "status");
