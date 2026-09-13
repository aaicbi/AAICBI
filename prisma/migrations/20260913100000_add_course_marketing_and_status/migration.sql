-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrainingFormat" AS ENUM ('SELF_PACED', 'INSTRUCTOR_LED', 'HYBRID');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "category" TEXT,
ADD COLUMN     "curriculumUploadedAt" TIMESTAMP(3),
ADD COLUMN     "curriculumUrl" TEXT,
ADD COLUMN     "durationDisplay" TEXT,
ADD COLUMN     "flyerUploadedAt" TIMESTAMP(3),
ADD COLUMN     "flyerUrl" TEXT,
ADD COLUMN     "instructorNames" TEXT,
ADD COLUMN     "learningOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "level" "Difficulty",
ADD COLUMN     "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "showAudience" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showCurriculumDownload" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showFlyer" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showOutline" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showRequirements" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showWhatToExpect" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showWhatYoullLearn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "skillsGained" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "targetAudience" TEXT,
ADD COLUMN     "trainingFormat" "TrainingFormat",
ADD COLUMN     "whatToExpect" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill: every course already published under the old boolean
-- becomes PUBLISHED under the new status enum. Every other existing
-- course stays at the column's own default (DRAFT) — matching what
-- published: false already meant for it (never publicly visible).
UPDATE "Course" SET "status" = 'PUBLISHED' WHERE "published" = true;

-- CreateIndex
CREATE INDEX "Course_status_idx" ON "Course"("status");
