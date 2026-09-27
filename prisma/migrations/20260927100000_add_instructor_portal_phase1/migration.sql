-- Instructor Portal, Phase 1 — payout configuration on Course, the
-- staff deactivation lever, and the agreement template/instance
-- system. Purely additive.

ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE TYPE "PayoutType" AS ENUM ('PERCENTAGE_OF_REVENUE', 'FLAT_PER_SUBSCRIBER');
CREATE TYPE "AgreementStatus" AS ENUM ('PENDING', 'ACCEPTED');

ALTER TABLE "Course" ADD COLUMN "payoutType" "PayoutType";
ALTER TABLE "Course" ADD COLUMN "payoutPercentage" INTEGER;
ALTER TABLE "Course" ADD COLUMN "payoutFlatRateKobo" INTEGER;
ALTER TABLE "Course" ADD COLUMN "payoutNotes" TEXT;
ALTER TABLE "Course" ADD COLUMN "payoutUpdatedById" TEXT;
ALTER TABLE "Course" ADD COLUMN "payoutUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Course" ADD CONSTRAINT "Course_payoutUpdatedById_fkey" FOREIGN KEY ("payoutUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AgreementTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementTemplate_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "AgreementTemplate" ADD CONSTRAINT "AgreementTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InstructorAgreement" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "content" TEXT NOT NULL,
    "monthlyCompensationKobo" INTEGER,
    "paymentFrequency" TEXT,
    "noticePeriodDays" INTEGER NOT NULL DEFAULT 30,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'PENDING',
    "sentById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "acceptedName" TEXT,
    "acceptedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstructorAgreement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstructorAgreement_instructorId_idx" ON "InstructorAgreement"("instructorId");

ALTER TABLE "InstructorAgreement" ADD CONSTRAINT "InstructorAgreement_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstructorAgreement" ADD CONSTRAINT "InstructorAgreement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AgreementTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstructorAgreement" ADD CONSTRAINT "InstructorAgreement_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
