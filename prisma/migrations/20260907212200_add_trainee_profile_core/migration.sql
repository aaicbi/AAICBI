-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('STUDENT', 'EMPLOYED', 'UNEMPLOYED', 'SELF_EMPLOYED');

-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('INTERNSHIP', 'FREELANCE', 'FULL_TIME', 'PART_TIME');

-- CreateEnum
CREATE TYPE "SkillProficiency" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- AlterTable
ALTER TABLE "Trainee" ADD COLUMN     "currentEmploymentStatus" "EmploymentStatus",
ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "openToWork" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "portfolioUrl" TEXT,
ADD COLUMN     "resumeUploadedAt" TIMESTAMP(3),
ADD COLUMN     "resumeUrl" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraineeSkill" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "proficiency" "SkillProficiency" NOT NULL DEFAULT 'INTERMEDIATE',

    CONSTRAINT "TraineeSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraineeAvailabilityType" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "type" "AvailabilityType" NOT NULL,

    CONSTRAINT "TraineeAvailabilityType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Education" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "credential" TEXT,
    "fieldOfStudy" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "current" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkExperience" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "employerName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "current" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE INDEX "TraineeSkill_skillId_idx" ON "TraineeSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "TraineeSkill_traineeId_skillId_key" ON "TraineeSkill"("traineeId", "skillId");

-- CreateIndex
CREATE INDEX "TraineeAvailabilityType_type_idx" ON "TraineeAvailabilityType"("type");

-- CreateIndex
CREATE UNIQUE INDEX "TraineeAvailabilityType_traineeId_type_key" ON "TraineeAvailabilityType"("traineeId", "type");

-- CreateIndex
CREATE INDEX "Education_traineeId_idx" ON "Education"("traineeId");

-- CreateIndex
CREATE INDEX "WorkExperience_traineeId_idx" ON "WorkExperience"("traineeId");

-- CreateIndex
CREATE INDEX "Project_traineeId_idx" ON "Project"("traineeId");

-- CreateIndex
CREATE UNIQUE INDEX "Trainee_username_key" ON "Trainee"("username");

-- AddForeignKey
ALTER TABLE "TraineeSkill" ADD CONSTRAINT "TraineeSkill_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeSkill" ADD CONSTRAINT "TraineeSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeAvailabilityType" ADD CONSTRAINT "TraineeAvailabilityType_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkExperience" ADD CONSTRAINT "WorkExperience_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

