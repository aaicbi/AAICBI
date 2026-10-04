-- Training Organizations — direct platform-fee billing, a second,
-- mutually-exclusive revenue model alongside the existing Paystack
-- Subaccount revenue-share: the organization pays AAICBI a recurring
-- fee directly instead of AAICBI auto-splitting trainee payments.

-- CreateEnum
CREATE TYPE "TrainingOrganizationBillingModel" AS ENUM ('REVENUE_SHARE', 'DIRECT_PAYMENT');

-- AlterTable
ALTER TABLE "TrainingOrganization" ADD COLUMN "billingModel" "TrainingOrganizationBillingModel" NOT NULL DEFAULT 'REVENUE_SHARE';
ALTER TABLE "TrainingOrganization" ADD COLUMN "platformFeeKobo" INTEGER;
ALTER TABLE "TrainingOrganization" ADD COLUMN "platformFeeBillingInterval" "BillingInterval";
ALTER TABLE "TrainingOrganization" ADD COLUMN "platformFeePaystackPlanCode" TEXT;
ALTER TABLE "TrainingOrganization" ADD COLUMN "platformFeePaystackCustomerCode" TEXT;
ALTER TABLE "TrainingOrganization" ADD COLUMN "platformFeePaystackSubscriptionCode" TEXT;
ALTER TABLE "TrainingOrganization" ADD COLUMN "platformFeeCurrentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "TrainingOrganization" ADD COLUMN "platformFeeAccessRevokedAt" TIMESTAMP(3);
ALTER TABLE "TrainingOrganization" ADD COLUMN "suspendTraineeAccessOnLapse" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "TrainingOrganization_platformFeePaystackSubscriptionCode_key" ON "TrainingOrganization"("platformFeePaystackSubscriptionCode");
