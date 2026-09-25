-- AlterEnum: adds UNLISTED to CourseStatus — reachable by a trainee
-- with a real CourseEnrollment, but excluded from every public catalog
-- surface. Purely additive; no existing rows change.
ALTER TYPE "CourseStatus" ADD VALUE 'UNLISTED';
