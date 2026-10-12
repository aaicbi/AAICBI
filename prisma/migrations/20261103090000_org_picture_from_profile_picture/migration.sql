-- An organization's public pages read its own picture (logoUrl), which nothing used to set, so they showed a letter. The picture
-- the organization had already uploaded as its profile picture is copied across (only where no picture is set yet).
UPDATE "TrainingOrganization" o
SET "logoUrl" = u."avatarUrl"
FROM "User" u
WHERE o."staffUserId" = u."id" AND o."logoUrl" IS NULL AND u."avatarUrl" IS NOT NULL;
