-- Approved guidance notes for the platform's AI features, versioned (append-only).
CREATE TABLE "AiGuidance" (
  "id" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "note" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "changedById" TEXT,
  "changedByName" TEXT,
  "changeNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiGuidance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiGuidance_feature_version_key" ON "AiGuidance"("feature", "version");
CREATE INDEX "AiGuidance_feature_createdAt_idx" ON "AiGuidance"("feature", "createdAt");
