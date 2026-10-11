-- A super admin decides where new payments for a course go: OWNER (follow the owner's billing setup) or PLATFORM (AAICBI keeps them).
ALTER TABLE "Course" ADD COLUMN "paymentsTo" TEXT NOT NULL DEFAULT 'OWNER';
