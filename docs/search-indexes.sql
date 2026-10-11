-- Optional: faster text search when the directory grows (tens of thousands of rows).
--
-- Search today matches words with case-insensitive "contains" queries and ranks the candidates in the application. That is
-- fine at the size of the platform now. When names, titles or posts reach the tens of thousands, trigram indexes make the
-- same queries use an index instead of reading every row.
--
-- This is NOT part of the automatic migrations on purpose: CREATE EXTENSION needs permission that some managed databases
-- only give to an administrator, and a migration that failed on it would block a deploy. Run it by hand, once, as a database
-- administrator, and check it with EXPLAIN. Nothing in the application depends on it. To undo, drop the indexes.

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
