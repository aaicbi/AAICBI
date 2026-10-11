-- Loop tells each member and employer once that their profile is public and how to change it; this records that it did.
ALTER TABLE "Trainee" ADD COLUMN "profileNoticeAt" TIMESTAMP(3);
ALTER TABLE "Employer" ADD COLUMN "profileNoticeAt" TIMESTAMP(3);
