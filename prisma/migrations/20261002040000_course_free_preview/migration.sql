-- Free preview modules for paid courses — a trainee can register and
-- access the first N modules (Course.freePreviewModuleCount) of a paid
-- course before paying. Both changes are purely additive; no existing
-- row changes meaning.

-- AlterEnum: PREVIEW marks a CourseEnrollment created for free-preview
-- purposes, with unlockedAt left null (hasCourseAccess() keeps
-- correctly returning false for it).
ALTER TYPE "EnrollmentSource" ADD VALUE 'PREVIEW';

-- AlterTable: null/unset means the feature is off for this course.
ALTER TABLE "Course" ADD COLUMN "freePreviewModuleCount" INTEGER;
