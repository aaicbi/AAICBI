-- Decided by the platform owner: every existing member and employer profile becomes public, like new accounts (see
-- 20261030090000_public_by_default). People can still choose a narrower setting any time in their profile settings.
-- Staff profiles are not touched (they are limited to private or signed-in only by design).
UPDATE "Trainee" SET "profileVisibility" = 'PUBLIC' WHERE "profileVisibility" <> 'PUBLIC';
UPDATE "Employer" SET "profileVisibility" = 'PUBLIC' WHERE "profileVisibility" <> 'PUBLIC';
