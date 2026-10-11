-- The profile identity layer: one public identity per account, on top of the existing account tables.
CREATE TYPE "ProfileKind" AS ENUM ('PERSON', 'TRAINING_ORG', 'EMPLOYER', 'INVESTOR', 'STAFF', 'STARTUP');

CREATE TABLE "Profile" (
  "id" TEXT NOT NULL,
  "kind" "ProfileKind" NOT NULL,
  "handle" TEXT NOT NULL,
  "traineeId" TEXT,
  "employerId" TEXT,
  "investorId" TEXT,
  "trainingOrganizationId" TEXT,
  "userId" TEXT,
  "startupId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Profile_handle_key" ON "Profile"("handle");
CREATE UNIQUE INDEX "Profile_traineeId_key" ON "Profile"("traineeId");
CREATE UNIQUE INDEX "Profile_employerId_key" ON "Profile"("employerId");
CREATE UNIQUE INDEX "Profile_investorId_key" ON "Profile"("investorId");
CREATE UNIQUE INDEX "Profile_trainingOrganizationId_key" ON "Profile"("trainingOrganizationId");
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
CREATE UNIQUE INDEX "Profile_startupId_key" ON "Profile"("startupId");
CREATE INDEX "Profile_kind_idx" ON "Profile"("kind");
