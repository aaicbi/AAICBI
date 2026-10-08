-- AlterTable: the public ecosystem switches now default to ON, and four
-- new switches cover the landing page sections, labelled example
-- placeholders, the public job board and the public trainee directory.
ALTER TABLE "PlatformSettings"
  ALTER COLUMN "ecosystemOrgPagesEnabled" SET DEFAULT true,
  ALTER COLUMN "ecosystemEducationEnabled" SET DEFAULT true,
  ALTER COLUMN "ecosystemFeedEnabled" SET DEFAULT true,
  ADD COLUMN "ecosystemLandingEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "ecosystemLandingPlaceholders" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "ecosystemPublicJobsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "ecosystemPublicTraineesEnabled" BOOLEAN NOT NULL DEFAULT true;

-- The existing settings row was created with the old defaults (off), and a
-- changed column default does not touch existing rows. Turn the three
-- original switches on there too, as requested.
UPDATE "PlatformSettings"
SET "ecosystemOrgPagesEnabled" = true,
    "ecosystemEducationEnabled" = true,
    "ecosystemFeedEnabled" = true;
