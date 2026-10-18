-- AlterTable
ALTER TABLE "ArenaMessage" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT;

-- AlterTable
ALTER TABLE "ArenaMatch" ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidedById" TEXT;

-- AlterTable
ALTER TABLE "ArenaRatingChange" ADD COLUMN "voided" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ArenaReport" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "handledById" TEXT,
    "handledNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ArenaReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArenaReport_courseId_status_createdAt_idx" ON "ArenaReport"("courseId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ArenaReport_reporterId_createdAt_idx" ON "ArenaReport"("reporterId", "createdAt");

-- AddForeignKey
ALTER TABLE "ArenaReport" ADD CONSTRAINT "ArenaReport_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
