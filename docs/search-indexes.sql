-- Manual retry for the text-search indexes (pg_trgm).
--
-- These indexes are created automatically by the migration 20261025090000_search_indexes, which is written so it can never
-- fail or block a deploy: when the database does not allow CREATE EXTENSION (some managed databases reserve it for an
-- administrator), a lock is busy, or anything else goes wrong, it skips that step and the deploy continues. Search works
-- without the indexes; they only make it faster once the directory is large.
--
-- Check what exists:   SELECT indexname FROM pg_indexes WHERE indexname LIKE '%\_trgm';
-- If some are missing, run this file once as a database administrator (CONCURRENTLY: no table locks; run each statement on
-- its own, not in a transaction). To undo, DROP INDEX the ones you do not want.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS trainee_name_trgm ON "Trainee" USING gin (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS trainee_location_trgm ON "Trainee" USING gin (location gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS skill_name_trgm ON "Skill" USING gin (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS employer_company_trgm ON "Employer" USING gin ("companyName" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS org_name_trgm ON "TrainingOrganization" USING gin (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS startup_name_trgm ON "Startup" USING gin (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS startup_tagline_trgm ON "Startup" USING gin (tagline gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS job_title_trgm ON "JobPosting" USING gin (title gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS course_title_trgm ON "Course" USING gin (title gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS post_body_trgm ON "Post" USING gin (body gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS profile_handle_trgm ON "Profile" USING gin (handle gin_trgm_ops);
