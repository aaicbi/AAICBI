-- Analytics System — Phase 2. Anonymous visitor tracking, a separate
-- table from AnalyticsEvent — see the model's own schema comment in
-- prisma/schema.prisma for the full reasoning.
CREATE TABLE "VisitorEvent" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT,
    "courseId" TEXT,
    "referrerSource" TEXT,
    "deviceCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisitorEvent_visitorId_type_idx" ON "VisitorEvent"("visitorId" ASC, "type" ASC);

CREATE INDEX "VisitorEvent_type_createdAt_idx" ON "VisitorEvent"("type" ASC, "createdAt" ASC);

CREATE INDEX "VisitorEvent_courseId_type_idx" ON "VisitorEvent"("courseId" ASC, "type" ASC);
