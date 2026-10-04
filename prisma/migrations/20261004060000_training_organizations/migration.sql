-- Training Organizations (Phase 1) — a new self-service account type,
-- a SUPER_ADMIN-only branded certificate template system, and the
-- nullable Course.certificateTemplateId that connects a course to one.

-- CreateEnum
CREATE TYPE "TrainingOrganizationApprovalState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "TrainingOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "approvalState" "TrainingOrganizationApprovalState" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "staffUserId" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiresAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "previousLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingOrganization_email_key" ON "TrainingOrganization"("email");
CREATE UNIQUE INDEX "TrainingOrganization_staffUserId_key" ON "TrainingOrganization"("staffUserId");
CREATE UNIQUE INDEX "TrainingOrganization_resetToken_key" ON "TrainingOrganization"("resetToken");
CREATE INDEX "TrainingOrganization_approvalState_idx" ON "TrainingOrganization"("approvalState");

-- AddForeignKey
ALTER TABLE "TrainingOrganization" ADD CONSTRAINT "TrainingOrganization_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingOrganization" ADD CONSTRAINT "TrainingOrganization_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CertificateTemplate" (
    "id" TEXT NOT NULL,
    "trainingOrganizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL,
    "reviewToken" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CertificateTemplate_reviewToken_key" ON "CertificateTemplate"("reviewToken");
CREATE INDEX "CertificateTemplate_trainingOrganizationId_idx" ON "CertificateTemplate"("trainingOrganizationId");

-- AddForeignKey
ALTER TABLE "CertificateTemplate" ADD CONSTRAINT "CertificateTemplate_trainingOrganizationId_fkey" FOREIGN KEY ("trainingOrganizationId") REFERENCES "TrainingOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "certificateTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_certificateTemplateId_fkey" FOREIGN KEY ("certificateTemplateId") REFERENCES "CertificateTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
