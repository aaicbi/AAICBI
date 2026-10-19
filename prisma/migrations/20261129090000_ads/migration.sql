-- Sponsored ads: bookings and their daily views and taps.
CREATE TABLE "AdBooking" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "advertiserName" TEXT NOT NULL,
  "advertiserKind" TEXT,
  "logoUrl" TEXT,
  "headline" TEXT NOT NULL,
  "caption" TEXT NOT NULL,
  "buttonLabel" TEXT NOT NULL,
  "linkUrl" TEXT NOT NULL,
  "mediaKind" TEXT NOT NULL,
  "mediaUrl" TEXT NOT NULL,
  "mediaType" TEXT NOT NULL,
  "mediaName" TEXT NOT NULL,
  "mediaSize" INTEGER NOT NULL,
  "placements" TEXT[],
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "priceKobo" INTEGER,
  "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "viewsTotal" INTEGER NOT NULL DEFAULT 0,
  "tapsTotal" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdBooking_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdBooking_organizationId_idx" ON "AdBooking"("organizationId");
CREATE INDEX "AdBooking_startsAt_endsAt_idx" ON "AdBooking"("startsAt", "endsAt");

CREATE TABLE "AdDaily" (
  "id" TEXT NOT NULL,
  "adId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "views" INTEGER NOT NULL DEFAULT 0,
  "taps" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AdDaily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdDaily_adId_day_key" ON "AdDaily"("adId", "day");
ALTER TABLE "AdDaily" ADD CONSTRAINT "AdDaily_adId_fkey" FOREIGN KEY ("adId") REFERENCES "AdBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
