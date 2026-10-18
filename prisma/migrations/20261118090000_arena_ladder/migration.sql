-- AlterTable
ALTER TABLE "ArenaConfig" ADD COLUMN "walletEnabled" BOOLEAN;

-- AlterTable
ALTER TABLE "ArenaCredit" ADD COLUMN "note" TEXT;

-- CreateTable
CREATE TABLE "ArenaRating" (
    "traineeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "matches" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaRating_pkey" PRIMARY KEY ("traineeId","courseId")
);

-- CreateTable
CREATE TABLE "ArenaRatingChange" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "before" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "counted" BOOLEAN NOT NULL DEFAULT true,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaRatingChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaChampion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "traineeId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaChampion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArenaRating_courseId_rating_idx" ON "ArenaRating"("courseId", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaRatingChange_matchId_traineeId_key" ON "ArenaRatingChange"("matchId", "traineeId");

-- CreateIndex
CREATE INDEX "ArenaRatingChange_courseId_createdAt_idx" ON "ArenaRatingChange"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "ArenaRatingChange_traineeId_createdAt_idx" ON "ArenaRatingChange"("traineeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaChampion_courseId_weekStart_key" ON "ArenaChampion"("courseId", "weekStart");

-- AddForeignKey
ALTER TABLE "ArenaRating" ADD CONSTRAINT "ArenaRating_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaRating" ADD CONSTRAINT "ArenaRating_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaRatingChange" ADD CONSTRAINT "ArenaRatingChange_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaRatingChange" ADD CONSTRAINT "ArenaRatingChange_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaChampion" ADD CONSTRAINT "ArenaChampion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaChampion" ADD CONSTRAINT "ArenaChampion_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
