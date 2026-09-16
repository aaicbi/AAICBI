-- CreateEnum
CREATE TYPE "CourseLocationType" AS ENUM ('PHYSICAL', 'ONLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "CourseLifecyclePhase" AS ENUM ('COMING_SOON', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'STARTED', 'COMPLETED');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "registrationDeadline" TIMESTAMP(3),
ADD COLUMN     "locationType" "CourseLocationType",
ADD COLUMN     "venue" TEXT,
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "lifecyclePhaseOverride" "CourseLifecyclePhase";

-- CreateIndex
CREATE INDEX "Course_startDate_idx" ON "Course"("startDate");
