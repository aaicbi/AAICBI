-- Instructor Portal, Phase 1 follow-up: aligns InstructorAgreement with
-- the real AAICBI Instructor Letter of Engagement's fields (address,
-- phone, position, course duration/end date, payment date, and the
-- live-session schedule line in the letter's own Section 4).
ALTER TABLE "InstructorAgreement"
  ADD COLUMN "paymentDate" TEXT,
  ADD COLUMN "endDate" TIMESTAMP(3),
  ADD COLUMN "instructorAddress" TEXT,
  ADD COLUMN "instructorPhone" TEXT,
  ADD COLUMN "position" TEXT,
  ADD COLUMN "courseDuration" TEXT,
  ADD COLUMN "liveSessionDay" TEXT,
  ADD COLUMN "liveSessionTime" TEXT,
  ADD COLUMN "liveSessionPlatform" TEXT;
