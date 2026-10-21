-- CreateEnum
CREATE TYPE "EventDelivery" AS ENUM ('PHYSICAL', 'ONLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "EventAudience" AS ENUM ('PUBLIC', 'ORG_MEMBERS', 'SELECTED_TRAINEES', 'ORG_STAFF', 'INVITED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventPromotionStatus" AS ENUM ('NONE', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EventRegistrationMode" AS ENUM ('OPEN', 'REGISTRATION', 'APPROVAL', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "EventRegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'DECLINED');

-- CreateTable
CREATE TABLE "EventCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "trainingOrganizationId" TEXT,
    "createdByUserId" TEXT,
    "createdByLabel" TEXT,
    "managedBy" TEXT NOT NULL DEFAULT 'ORG',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "categoryId" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'OTHER',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "registrationDeadline" TIMESTAMP(3),
    "capacity" INTEGER,
    "delivery" "EventDelivery" NOT NULL DEFAULT 'PHYSICAL',
    "venueName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "directions" TEXT,
    "mapUrl" TEXT,
    "attendanceNotes" TEXT,
    "conferenceProvider" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "audience" "EventAudience" NOT NULL DEFAULT 'PRIVATE',
    "registrationMode" "EventRegistrationMode" NOT NULL DEFAULT 'OPEN',
    "registrationNotes" TEXT,
    "registrationUrl" TEXT,
    "hybridSeparateRegistration" BOOLEAN NOT NULL DEFAULT false,
    "flyerUrl" TEXT,
    "videoUrl" TEXT,
    "videoKind" TEXT,
    "promotionStatus" "EventPromotionStatus" NOT NULL DEFAULT 'NONE',
    "promotionNote" TEXT,
    "promotionRequestedAt" TIMESTAMP(3),
    "promotionDecidedAt" TIMESTAMP(3),
    "promotionDecidedById" TEXT,
    "publishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "joinOpensMinutes" INTEGER,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventJoinInfo" (
    "eventId" TEXT NOT NULL,
    "meetingUrl" TEXT NOT NULL,
    "meetingId" TEXT,
    "passcodeEnc" TEXT,
    "instructions" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventJoinInfo_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "EventTarget" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,

    CONSTRAINT "EventTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMedia" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "attendanceMode" TEXT,
    "status" "EventRegistrationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "attendedMarkedAt" TIMESTAMP(3),
    "attendedMarkedById" TEXT,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventActivity" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "actorKind" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventNotice" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "orgEventsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "promotionsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "showPast" BOOLEAN NOT NULL DEFAULT true,
    "joinOpensMinutes" INTEGER NOT NULL DEFAULT 15,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventCategory_name_key" ON "EventCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EventCategory_slug_key" ON "EventCategory"("slug");

-- CreateIndex
CREATE INDEX "Event_trainingOrganizationId_startsAt_idx" ON "Event"("trainingOrganizationId", "startsAt");

-- CreateIndex
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Event_audience_promotionStatus_startsAt_idx" ON "Event"("audience", "promotionStatus", "startsAt");

-- CreateIndex
CREATE INDEX "Event_promotionStatus_promotionRequestedAt_idx" ON "Event"("promotionStatus", "promotionRequestedAt");

-- CreateIndex
CREATE INDEX "Event_categoryId_idx" ON "Event"("categoryId");

-- CreateIndex
CREATE INDEX "EventTarget_kind_refId_idx" ON "EventTarget"("kind", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "EventTarget_eventId_kind_refId_key" ON "EventTarget"("eventId", "kind", "refId");

-- CreateIndex
CREATE INDEX "EventMedia_eventId_sortOrder_idx" ON "EventMedia"("eventId", "sortOrder");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_status_idx" ON "EventRegistration"("eventId", "status");

-- CreateIndex
CREATE INDEX "EventRegistration_profileId_createdAt_idx" ON "EventRegistration"("profileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_eventId_profileId_key" ON "EventRegistration"("eventId", "profileId");

-- CreateIndex
CREATE INDEX "EventActivity_eventId_createdAt_idx" ON "EventActivity"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "EventNotice_eventId_kind_idx" ON "EventNotice"("eventId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "EventNotice_eventId_recipientType_recipientId_kind_key" ON "EventNotice"("eventId", "recipientType", "recipientId", "kind");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_trainingOrganizationId_fkey" FOREIGN KEY ("trainingOrganizationId") REFERENCES "TrainingOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventJoinInfo" ADD CONSTRAINT "EventJoinInfo_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTarget" ADD CONSTRAINT "EventTarget_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMedia" ADD CONSTRAINT "EventMedia_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventActivity" ADD CONSTRAINT "EventActivity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventNotice" ADD CONSTRAINT "EventNotice_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Starting data -------------------------------------------------------------------------------------------------------------------
INSERT INTO "EventSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING;

INSERT INTO "EventCategory" ("id", "name", "slug", "sortOrder") VALUES
  ('evcat_training', 'Training and classes', 'training', 1),
  ('evcat_workshop', 'Workshops and demonstrations', 'workshops', 2),
  ('evcat_webinar', 'Webinars and public lectures', 'webinars', 3),
  ('evcat_community', 'Community and networking', 'community', 4),
  ('evcat_competition', 'Competitions and hackathons', 'competitions', 5),
  ('evcat_ceremony', 'Graduations and ceremonies', 'ceremonies', 6),
  ('evcat_meeting', 'Meetings', 'meetings', 7)
ON CONFLICT DO NOTHING;

-- Copy the events organisations already published. The old table is left exactly as it was; the copies keep the same ids so
-- existing links keep working. Nothing is deleted or changed in OrganizationEvent.
INSERT INTO "Event" ("id", "trainingOrganizationId", "title", "description", "startsAt", "endsAt", "timeZone", "delivery", "address",
  "registrationUrl", "status", "audience", "registrationMode", "promotionStatus", "publishedAt", "promotionNote", "isDemo", "createdAt", "updatedAt")
SELECT o."id", o."trainingOrganizationId", o."title", o."description", o."startsAt", COALESCE(o."endsAt", o."startsAt" + INTERVAL '2 hours'), 'Africa/Lagos',
  'PHYSICAL', o."locationText", o."registrationUrl",
  CASE WHEN o."status" = 'PUBLISHED' THEN 'SCHEDULED'::"EventStatus" ELSE 'ARCHIVED'::"EventStatus" END,
  'PUBLIC', 'OPEN',
  CASE WHEN o."status" = 'PUBLISHED' THEN 'PUBLISHED'::"EventPromotionStatus" ELSE 'REJECTED'::"EventPromotionStatus" END,
  CASE WHEN o."status" = 'PUBLISHED' THEN o."createdAt" ELSE NULL END,
  CASE WHEN o."status" = 'PUBLISHED' THEN NULL ELSE 'Taken down by a Super Admin before the Event Manager existed.' END,
  o."isDemo", o."createdAt", o."updatedAt"
FROM "OrganizationEvent" o
ON CONFLICT DO NOTHING;
