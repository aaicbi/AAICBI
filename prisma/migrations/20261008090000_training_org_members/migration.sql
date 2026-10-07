-- CreateTable
CREATE TABLE "TrainingOrganizationMember" (
    "id" TEXT NOT NULL,
    "trainingOrganizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "setupToken" TEXT,
    "setupTokenExpiresAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingOrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingOrganizationMember_email_key" ON "TrainingOrganizationMember"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingOrganizationMember_setupToken_key" ON "TrainingOrganizationMember"("setupToken");

-- CreateIndex
CREATE INDEX "TrainingOrganizationMember_trainingOrganizationId_idx" ON "TrainingOrganizationMember"("trainingOrganizationId");

-- AddForeignKey
ALTER TABLE "TrainingOrganizationMember" ADD CONSTRAINT "TrainingOrganizationMember_trainingOrganizationId_fkey" FOREIGN KEY ("trainingOrganizationId") REFERENCES "TrainingOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
