-- Growth funnel: squad challenges. A squad is a group whose members play the same questions; its score is the members' total.
ALTER TABLE "GrowthGuestPlay" ADD COLUMN "squadId" TEXT, ADD COLUMN "rivalSquadId" TEXT;
CREATE INDEX "GrowthGuestPlay_squadId_idx" ON "GrowthGuestPlay"("squadId");

CREATE TABLE "GrowthSquad" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "questionIds" JSONB NOT NULL,
  "rivalOfId" TEXT,
  "captainPlayId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrowthSquad_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrowthSquad_code_key" ON "GrowthSquad"("code");
CREATE INDEX "GrowthSquad_campaignId_idx" ON "GrowthSquad"("campaignId");
CREATE INDEX "GrowthSquad_rivalOfId_idx" ON "GrowthSquad"("rivalOfId");
ALTER TABLE "GrowthSquad" ADD CONSTRAINT "GrowthSquad_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GrowthCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
