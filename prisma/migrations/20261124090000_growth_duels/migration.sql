-- Growth funnel: async duels (a friend plays the same five questions) and the public share code behind the result card.
ALTER TABLE "GrowthGuestPlay" ADD COLUMN "nickname" TEXT, ADD COLUMN "shareCode" TEXT, ADD COLUMN "duelOfId" TEXT, ADD COLUMN "durationMs" INTEGER;
CREATE UNIQUE INDEX "GrowthGuestPlay_shareCode_key" ON "GrowthGuestPlay"("shareCode");
CREATE INDEX "GrowthGuestPlay_duelOfId_idx" ON "GrowthGuestPlay"("duelOfId");
