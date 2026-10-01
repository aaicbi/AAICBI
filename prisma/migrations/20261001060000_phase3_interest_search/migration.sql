-- Analytics System — Phase 3. Visitor-to-trainee linking and search
-- tracking — see the schema's own comments on Trainee.registrationVisitorId
-- and VisitorEvent.searchQuery/resultCount for the full reasoning.
ALTER TABLE "Trainee" ADD COLUMN "registrationVisitorId" TEXT;

ALTER TABLE "VisitorEvent" ADD COLUMN "searchQuery" TEXT;
ALTER TABLE "VisitorEvent" ADD COLUMN "resultCount" INTEGER;
