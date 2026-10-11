-- Handle changes are requested and decided by a super admin; former handles stay reserved and resolvable.
CREATE TABLE "HandleChangeRequest" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "currentHandle" TEXT NOT NULL,
  "requestedHandle" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "decidedById" TEXT,
  "decidedByName" TEXT,
  "decisionNote" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HandleChangeRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HandleChangeRequest_status_createdAt_idx" ON "HandleChangeRequest"("status", "createdAt");
CREATE INDEX "HandleChangeRequest_profileId_createdAt_idx" ON "HandleChangeRequest"("profileId", "createdAt");

CREATE TABLE "ProfileHandleHistory" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedById" TEXT,
  "reason" TEXT,
  CONSTRAINT "ProfileHandleHistory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProfileHandleHistory_handle_key" ON "ProfileHandleHistory"("handle");
CREATE INDEX "ProfileHandleHistory_profileId_idx" ON "ProfileHandleHistory"("profileId");
