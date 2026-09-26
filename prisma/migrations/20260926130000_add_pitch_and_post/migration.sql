-- Pitch & Post, Phase 1 — submission, admin review, and a small,
-- staff-created pool of investors. Purely additive: new enums and new
-- tables only, nothing existing changes shape.

CREATE TYPE "PitchStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_REVISION', 'APPROVED', 'REJECTED', 'PUBLISHED');
CREATE TYPE "PitchFundingType" AS ENUM ('GRANT', 'DEBT');
CREATE TYPE "PitchDisclosureStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

CREATE TABLE "PitchCohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "submissionDeadline" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PitchCohort_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PitchSubmission" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "cohortId" TEXT,
    "status" "PitchStatus" NOT NULL DEFAULT 'DRAFT',
    "startupName" TEXT NOT NULL,
    "industry" TEXT,
    "problem" TEXT,
    "solution" TEXT,
    "targetMarket" TEXT,
    "businessModel" TEXT,
    "stage" TEXT,
    "traction" TEXT,
    "teamDescription" TEXT,
    "pitchVideoUrl" TEXT,
    "pitchDeckUrl" TEXT,
    "demoUrl" TEXT,
    "githubUrl" TEXT,
    "fundingType" "PitchFundingType",
    "fundingAmountKobo" INTEGER,
    "minimumInvestmentKobo" INTEGER,
    "fundingPurpose" TEXT,
    "technicalScore" INTEGER,
    "businessScore" INTEGER,
    "marketScore" INTEGER,
    "pitchQualityScore" INTEGER,
    "documentationScore" INTEGER,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReasonCategory" TEXT,
    "rejectionNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PitchSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PitchSubmission_traineeId_idx" ON "PitchSubmission"("traineeId");
CREATE INDEX "PitchSubmission_status_idx" ON "PitchSubmission"("status");
CREATE INDEX "PitchSubmission_cohortId_idx" ON "PitchSubmission"("cohortId");

ALTER TABLE "PitchSubmission" ADD CONSTRAINT "PitchSubmission_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PitchSubmission" ADD CONSTRAINT "PitchSubmission_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "PitchCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PitchSubmission" ADD CONSTRAINT "PitchSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "resetToken" TEXT,
    "resetTokenExpiresAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Investor_email_key" ON "Investor"("email");
CREATE UNIQUE INDEX "Investor_resetToken_key" ON "Investor"("resetToken");

ALTER TABLE "Investor" ADD CONSTRAINT "Investor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PitchDisclosure" (
    "id" TEXT NOT NULL,
    "pitchSubmissionId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "status" "PitchDisclosureStatus" NOT NULL DEFAULT 'PENDING',
    "requestMessage" TEXT,
    "shareVideo" BOOLEAN NOT NULL DEFAULT false,
    "shareDeck" BOOLEAN NOT NULL DEFAULT false,
    "shareDemo" BOOLEAN NOT NULL DEFAULT false,
    "shareGithub" BOOLEAN NOT NULL DEFAULT false,
    "respondedAt" TIMESTAMP(3),
    "interestMessage" TEXT,
    "interestRangeKobo" INTEGER,
    "interestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PitchDisclosure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PitchDisclosure_pitchSubmissionId_investorId_key" ON "PitchDisclosure"("pitchSubmissionId", "investorId");

ALTER TABLE "PitchDisclosure" ADD CONSTRAINT "PitchDisclosure_pitchSubmissionId_fkey" FOREIGN KEY ("pitchSubmissionId") REFERENCES "PitchSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PitchDisclosure" ADD CONSTRAINT "PitchDisclosure_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
