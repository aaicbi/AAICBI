-- Collaboration on courses, examinations and assignments through share links.
CREATE TABLE "ContentCollaborator" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentCollaborator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContentCollaborator_resourceType_resourceId_userId_key" ON "ContentCollaborator"("resourceType", "resourceId", "userId");
CREATE INDEX "ContentCollaborator_userId_resourceType_idx" ON "ContentCollaborator"("userId", "resourceType");
CREATE INDEX "ContentCollaborator_resourceType_resourceId_idx" ON "ContentCollaborator"("resourceType", "resourceId");

CREATE TABLE "ContentShareLink" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 10,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentShareLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContentShareLink_tokenHash_key" ON "ContentShareLink"("tokenHash");
CREATE INDEX "ContentShareLink_resourceType_resourceId_idx" ON "ContentShareLink"("resourceType", "resourceId");
