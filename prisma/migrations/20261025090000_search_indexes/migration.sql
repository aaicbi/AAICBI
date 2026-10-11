-- Optional text-search indexes (pg_trgm). SAFE BY DESIGN: this migration can never fail.
--
-- CREATE EXTENSION needs permission that some managed databases only give to an administrator, and a migration that
-- failed would block the deploy. So every step runs in its own guarded block: if the extension cannot be created, a table
-- or column is missing, a lock cannot be taken quickly, or anything else goes wrong, that step is skipped with a NOTICE and
-- the migration still succeeds. Search works without these indexes (just without the speed-up); re-running
-- docs/search-indexes.sql as an administrator adds whatever was skipped.
--
-- Not CREATE INDEX CONCURRENTLY: it cannot run inside the migration's transaction. lock_timeout keeps a busy table from
-- making the deploy wait; the skipped index can be added later.

DO $mig$
DECLARE
  spec text[];
  specs text[][] := ARRAY[
    ['trainee_name_trgm', 'Trainee', 'name'],
    ['trainee_location_trgm', 'Trainee', 'location'],
    ['skill_name_trgm', 'Skill', 'name'],
    ['employer_company_trgm', 'Employer', 'companyName'],
    ['org_name_trgm', 'TrainingOrganization', 'name'],
    ['startup_name_trgm', 'Startup', 'name'],
    ['startup_tagline_trgm', 'Startup', 'tagline'],
    ['job_title_trgm', 'JobPosting', 'title'],
    ['course_title_trgm', 'Course', 'title'],
    ['post_body_trgm', 'Post', 'body'],
    ['profile_handle_trgm', 'Profile', 'handle']
  ];
BEGIN
  BEGIN
    SET LOCAL lock_timeout = '3s';
    SET LOCAL statement_timeout = '60s';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'search_indexes: could not set timeouts (%), continuing', SQLERRM;
  END;

  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'search_indexes: pg_trgm could not be created (%), skipping text-search indexes', SQLERRM;
  END;

  -- The operator class is the real requirement (the extension may already exist, e.g. created by an administrator).
  IF NOT EXISTS (SELECT 1 FROM pg_opclass WHERE opcname = 'gin_trgm_ops') THEN
    RAISE NOTICE 'search_indexes: pg_trgm is not available, skipping text-search indexes';
    RETURN;
  END IF;

  FOREACH spec SLICE 1 IN ARRAY specs LOOP
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I USING gin (%I gin_trgm_ops)', spec[1], spec[2], spec[3]);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'search_indexes: skipped % (%)', spec[1], SQLERRM;
    END;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'search_indexes: skipped entirely (%)', SQLERRM;
END
$mig$;
