-- AlterTable
ALTER TABLE "User" ADD COLUMN     "permissionDenies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "permissionGrants" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "staffNumber" TEXT,
ADD COLUMN     "staffRoleKey" TEXT;

-- CreateTable
CREATE TABLE "StaffRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "organizationId" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'OK',
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgGamingPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "resultsView" BOOLEAN NOT NULL DEFAULT true,
    "resultsExport" BOOLEAN NOT NULL DEFAULT false,
    "liveMonitor" BOOLEAN NOT NULL DEFAULT true,
    "endSessions" BOOLEAN NOT NULL DEFAULT true,
    "restrictTrainees" BOOLEAN NOT NULL DEFAULT true,
    "removeParticipants" BOOLEAN NOT NULL DEFAULT true,
    "chatGameModeration" BOOLEAN NOT NULL DEFAULT true,
    "toggleGames" BOOLEAN NOT NULL DEFAULT false,
    "courseRules" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgGamingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameModerationAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "courseId" TEXT,
    "matchId" TEXT,
    "traineeId" TEXT,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffRole_key_key" ON "StaffRole"("key");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrgGamingPolicy_organizationId_key" ON "OrgGamingPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "GameModerationAction_organizationId_createdAt_idx" ON "GameModerationAction"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "GameModerationAction_traineeId_createdAt_idx" ON "GameModerationAction"("traineeId", "createdAt");

-- CreateIndex
CREATE INDEX "GameModerationAction_escalatedAt_idx" ON "GameModerationAction"("escalatedAt");
