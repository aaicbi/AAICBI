-- Certificate watermark removal — a second, independent monthly
-- subscription product any training org can hold regardless of
-- billingModel, mirroring the existing platformFee* field group's
-- exact shape as its own fully separate instance.

-- AlterTable
ALTER TABLE "TrainingOrganization" ADD COLUMN "certWatermarkFeeKobo" INTEGER;
ALTER TABLE "TrainingOrganization" ADD COLUMN "certWatermarkBillingInterval" "BillingInterval";
ALTER TABLE "TrainingOrganization" ADD COLUMN "certWatermarkPaystackPlanCode" TEXT;
ALTER TABLE "TrainingOrganization" ADD COLUMN "certWatermarkPaystackCustomerCode" TEXT;
ALTER TABLE "TrainingOrganization" ADD COLUMN "certWatermarkPaystackSubscriptionCode" TEXT;
ALTER TABLE "TrainingOrganization" ADD COLUMN "certWatermarkCurrentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "TrainingOrganization" ADD COLUMN "certWatermarkAccessRevokedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingOrganization_certWatermarkPaystackSubscriptionCode_key" ON "TrainingOrganization"("certWatermarkPaystackSubscriptionCode");
