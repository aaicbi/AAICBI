-- New members and new employers start with a public profile so people can find them. Only the default for NEW rows changes:
-- accounts that already exist keep exactly the visibility they have (nobody's details are exposed by this migration).
ALTER TABLE "Trainee" ALTER COLUMN "profileVisibility" SET DEFAULT 'PUBLIC';
ALTER TABLE "Employer" ALTER COLUMN "profileVisibility" SET DEFAULT 'PUBLIC';
