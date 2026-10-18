-- Growth funnel: follow-up messages to people who saved their score (outbox) and a free-form config on a setting row.
ALTER TABLE "GrowthSetting" ADD COLUMN "config" JSONB;

CREATE TABLE "GrowthMessage" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "toPhone" TEXT,
  "toEmail" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "providerMessageId" TEXT,
  "error" TEXT,
  "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrowthMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrowthMessage_leadId_kind_key" ON "GrowthMessage"("leadId", "kind");
CREATE INDEX "GrowthMessage_status_scheduledFor_idx" ON "GrowthMessage"("status", "scheduledFor");
CREATE INDEX "GrowthMessage_providerMessageId_idx" ON "GrowthMessage"("providerMessageId");
CREATE INDEX "GrowthMessage_sentAt_idx" ON "GrowthMessage"("sentAt");
ALTER TABLE "GrowthMessage" ADD CONSTRAINT "GrowthMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "GrowthLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
