-- Per-person Game Studio permissions (null = default set) and the change-request inbox.
ALTER TABLE "User" ADD COLUMN "studioPermissions" JSONB;

CREATE TYPE "ChangeRequestStatus" AS ENUM ('PROPOSED', 'APPROVED', 'DONE', 'DECLINED');

CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "page" TEXT,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PROPOSED',
    "authorId" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "issueUrl" TEXT,
    "prUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChangeRequest_status_createdAt_idx" ON "ChangeRequest"("status", "createdAt");
CREATE INDEX "ChangeRequest_authorId_idx" ON "ChangeRequest"("authorId");

ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
