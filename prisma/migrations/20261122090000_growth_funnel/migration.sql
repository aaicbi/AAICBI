-- Ayakbi Arena growth funnel: switches, per-course campaigns, taster questions, guest plays, audit.
CREATE TABLE "GrowthSetting" (
  "id" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "agreementAt" TIMESTAMP(3),
  "agreementById" TEXT,
  "commissionBps" INTEGER,
  "scholarshipEnabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrowthSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrowthSetting_scopeType_scopeId_key" ON "GrowthSetting"("scopeType", "scopeId");

CREATE TABLE "GrowthCampaign" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "tasterApprovedAt" TIMESTAMP(3),
  "tasterApprovedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrowthCampaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrowthCampaign_courseId_key" ON "GrowthCampaign"("courseId");
CREATE UNIQUE INDEX "GrowthCampaign_slug_key" ON "GrowthCampaign"("slug");
ALTER TABLE "GrowthCampaign" ADD CONSTRAINT "GrowthCampaign_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GrowthTasterQuestion" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "GrowthTasterQuestion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrowthTasterQuestion_campaignId_questionId_key" ON "GrowthTasterQuestion"("campaignId", "questionId");
CREATE INDEX "GrowthTasterQuestion_campaignId_position_idx" ON "GrowthTasterQuestion"("campaignId", "position");
ALTER TABLE "GrowthTasterQuestion" ADD CONSTRAINT "GrowthTasterQuestion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GrowthCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GrowthGuestPlay" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "source" TEXT,
  "questionIds" JSONB NOT NULL,
  "answers" JSONB NOT NULL DEFAULT '[]',
  "score" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "GrowthGuestPlay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrowthGuestPlay_token_key" ON "GrowthGuestPlay"("token");
CREATE INDEX "GrowthGuestPlay_campaignId_startedAt_idx" ON "GrowthGuestPlay"("campaignId", "startedAt");
CREATE INDEX "GrowthGuestPlay_campaignId_completedAt_idx" ON "GrowthGuestPlay"("campaignId", "completedAt");
ALTER TABLE "GrowthGuestPlay" ADD CONSTRAINT "GrowthGuestPlay_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GrowthCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GrowthAudit" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL DEFAULT '',
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrowthAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GrowthAudit_createdAt_idx" ON "GrowthAudit"("createdAt");
