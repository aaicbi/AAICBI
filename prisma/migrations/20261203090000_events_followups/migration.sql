-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "seriesId" TEXT,
ADD COLUMN     "seriesIndex" INTEGER;

-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN     "attendanceSource" TEXT;

-- AlterTable
ALTER TABLE "EventSettings" ADD COLUMN     "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastSweepAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Event_seriesId_startsAt_idx" ON "Event"("seriesId", "startsAt");

