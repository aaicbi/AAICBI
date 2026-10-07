-- CreateEnum
CREATE TYPE "EducationReactionKind" AS ENUM ('LIKE', 'SAVE');

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "ecosystemFeedEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OrganizationFollow" (
    "traineeId" TEXT NOT NULL,
    "trainingOrganizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationFollow_pkey" PRIMARY KEY ("traineeId","trainingOrganizationId")
);

-- CreateTable
CREATE TABLE "EducationPostReaction" (
    "postId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "kind" "EducationReactionKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EducationPostReaction_pkey" PRIMARY KEY ("postId","traineeId","kind")
);

-- CreateIndex
CREATE INDEX "OrganizationFollow_trainingOrganizationId_idx" ON "OrganizationFollow"("trainingOrganizationId");

-- CreateIndex
CREATE INDEX "EducationPostReaction_traineeId_kind_idx" ON "EducationPostReaction"("traineeId", "kind");

-- AddForeignKey
ALTER TABLE "OrganizationFollow" ADD CONSTRAINT "OrganizationFollow_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationFollow" ADD CONSTRAINT "OrganizationFollow_trainingOrganizationId_fkey" FOREIGN KEY ("trainingOrganizationId") REFERENCES "TrainingOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationPostReaction" ADD CONSTRAINT "EducationPostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "EducationPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationPostReaction" ADD CONSTRAINT "EducationPostReaction_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

