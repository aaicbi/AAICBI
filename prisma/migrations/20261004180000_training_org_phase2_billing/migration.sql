-- Training Organizations (Phase 2) — Paystack Subaccount revenue split
-- and the "Powered by aaicbi.org" premium-removal toggle. Both live on
-- TrainingOrganization directly; no other schema change needed for
-- Phase 2 (course content/exam/certificate-assignment reuses existing
-- tables unchanged).

-- AlterTable
ALTER TABLE "TrainingOrganization" ADD COLUMN "paystackSubaccountCode" TEXT;
ALTER TABLE "TrainingOrganization" ADD COLUMN "brandingFooterRemoved" BOOLEAN NOT NULL DEFAULT false;
