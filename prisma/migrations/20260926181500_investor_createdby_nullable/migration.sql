-- Pitch & Post, Phase 2 — self-registered investors (POST
-- /api/auth/investor-register) have no creating admin, unlike Phase
-- 1's admin-direct-create path. The existing foreign key already
-- allows NULL (Postgres doesn't check FK constraints against a NULL
-- value), so this only needs to drop the NOT NULL constraint.
ALTER TABLE "Investor" ALTER COLUMN "createdById" DROP NOT NULL;
