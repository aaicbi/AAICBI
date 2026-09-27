-- Pitch & Post, Phase 2 (legal-safe slice) — the public teaser fields
-- and investor self-registration approval state. Purely additive.

ALTER TABLE "PitchSubmission" ADD COLUMN "teaserVideoUrl" TEXT;
ALTER TABLE "PitchSubmission" ADD COLUMN "projectedReturnSummary" TEXT;
ALTER TABLE "PitchSubmission" ADD COLUMN "publicImpactStatement" TEXT;

CREATE TYPE "InvestorApprovalState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Existing (Phase 1, admin-created) investor rows are already vetted by
-- the admin who created them — default them to APPROVED explicitly so
-- this migration never silently locks out an existing account. New
-- rows use the column's own PENDING default from here on (self-
-- registration route never sets it explicitly, matching Employer's).
ALTER TABLE "Investor" ADD COLUMN "approvalState" "InvestorApprovalState" NOT NULL DEFAULT 'PENDING';
UPDATE "Investor" SET "approvalState" = 'APPROVED';

ALTER TABLE "Investor" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Investor" ADD COLUMN "approvedAt" TIMESTAMP(3);
UPDATE "Investor" SET "approvedById" = "createdById", "approvedAt" = "createdAt";

ALTER TABLE "Investor" ADD CONSTRAINT "Investor_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
