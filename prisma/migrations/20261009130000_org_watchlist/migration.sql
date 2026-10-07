-- CreateTable
CREATE TABLE "OrganizationWatchlistItem" (
    "investorId" TEXT NOT NULL,
    "trainingOrganizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationWatchlistItem_pkey" PRIMARY KEY ("investorId","trainingOrganizationId")
);

-- CreateIndex
CREATE INDEX "OrganizationWatchlistItem_trainingOrganizationId_idx" ON "OrganizationWatchlistItem"("trainingOrganizationId");

-- AddForeignKey
ALTER TABLE "OrganizationWatchlistItem" ADD CONSTRAINT "OrganizationWatchlistItem_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationWatchlistItem" ADD CONSTRAINT "OrganizationWatchlistItem_trainingOrganizationId_fkey" FOREIGN KEY ("trainingOrganizationId") REFERENCES "TrainingOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

