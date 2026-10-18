-- Growth funnel: the commission ledger for payments that came through a campaign for an organization's course.
CREATE TABLE "GrowthCommission" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "organizationId" TEXT,
  "traineeId" TEXT NOT NULL,
  "source" TEXT,
  "amountKobo" INTEGER NOT NULL,
  "rateBps" INTEGER NOT NULL,
  "commissionKobo" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OWED',
  "note" TEXT,
  "settledAt" TIMESTAMP(3),
  "settledById" TEXT,
  "reversedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrowthCommission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrowthCommission_paymentId_key" ON "GrowthCommission"("paymentId");
CREATE INDEX "GrowthCommission_organizationId_status_idx" ON "GrowthCommission"("organizationId", "status");
CREATE INDEX "GrowthCommission_courseId_idx" ON "GrowthCommission"("courseId");
CREATE INDEX "GrowthCommission_paidAt_idx" ON "GrowthCommission"("paidAt");
