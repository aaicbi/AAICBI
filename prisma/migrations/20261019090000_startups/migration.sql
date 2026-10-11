-- Startups: their own entity with a team and a public profile (handle on a Profile of kind STARTUP).
CREATE TYPE "StartupStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "StartupStage" AS ENUM ('IDEA', 'PROTOTYPE', 'MVP', 'LAUNCHED', 'GROWTH');
CREATE TYPE "StartupMemberRole" AS ENUM ('FOUNDER', 'MEMBER');

CREATE TABLE "Startup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tagline" TEXT,
  "problem" TEXT,
  "solution" TEXT,
  "description" TEXT,
  "industry" TEXT,
  "stage" "StartupStage" NOT NULL DEFAULT 'IDEA',
  "location" TEXT,
  "website" TEXT,
  "logoUrl" TEXT,
  "traction" TEXT,
  "fundingNeed" TEXT,
  "seeking" TEXT[],
  "status" "StartupStatus" NOT NULL DEFAULT 'DRAFT',
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "reviewNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Startup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Startup_status_createdAt_idx" ON "Startup"("status", "createdAt");

CREATE TABLE "StartupMember" (
  "id" TEXT NOT NULL,
  "startupId" TEXT NOT NULL,
  "traineeId" TEXT NOT NULL,
  "role" "StartupMemberRole" NOT NULL DEFAULT 'MEMBER',
  "canEdit" BOOLEAN NOT NULL DEFAULT false,
  "canPublish" BOOLEAN NOT NULL DEFAULT false,
  "title" TEXT,
  "showOnProfile" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'INVITED',
  "invitedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "joinedAt" TIMESTAMP(3),
  CONSTRAINT "StartupMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StartupMember_startupId_traineeId_key" ON "StartupMember"("startupId", "traineeId");
CREATE INDEX "StartupMember_traineeId_status_idx" ON "StartupMember"("traineeId", "status");
ALTER TABLE "StartupMember" ADD CONSTRAINT "StartupMember_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "Startup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
