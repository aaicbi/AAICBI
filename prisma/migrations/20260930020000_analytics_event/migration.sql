-- Analytics System — Phase 1. One flexible, log-shaped table for
-- registered-user in-app behaviour — see the model's own schema
-- comment in prisma/schema.prisma for the full reasoning.
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "courseId" TEXT,
    "relatedId" TEXT,
    "properties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsEvent_userId_type_idx" ON "AnalyticsEvent"("userId" ASC, "type" ASC);

CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type" ASC, "createdAt" ASC);

CREATE INDEX "AnalyticsEvent_courseId_type_idx" ON "AnalyticsEvent"("courseId" ASC, "type" ASC);
