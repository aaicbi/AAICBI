-- AlterTable
ALTER TABLE "ArenaConfig" ADD COLUMN "fastestEnabled" BOOLEAN;

-- AlterTable
ALTER TABLE "ArenaChatMessage" ALTER COLUMN "senderId" DROP NOT NULL,
ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'TEXT',
ADD COLUMN "refId" TEXT;

-- CreateTable
CREATE TABLE "ArenaSprint" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctKey" TEXT NOT NULL,
    "explanation" TEXT,
    "sourceQuestionId" TEXT,
    "points" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "winnerId" TEXT,
    "wonAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ArenaSprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaSprintAnswer" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaSprintAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaCredit" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArenaSprint_courseId_createdAt_idx" ON "ArenaSprint"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "ArenaSprint_courseId_status_idx" ON "ArenaSprint"("courseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaSprintAnswer_sprintId_traineeId_key" ON "ArenaSprintAnswer"("sprintId", "traineeId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaCredit_traineeId_reason_refId_key" ON "ArenaCredit"("traineeId", "reason", "refId");

-- CreateIndex
CREATE INDEX "ArenaCredit_traineeId_createdAt_idx" ON "ArenaCredit"("traineeId", "createdAt");

-- CreateIndex
CREATE INDEX "ArenaCredit_courseId_traineeId_idx" ON "ArenaCredit"("courseId", "traineeId");

-- AddForeignKey
ALTER TABLE "ArenaSprint" ADD CONSTRAINT "ArenaSprint_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaSprint" ADD CONSTRAINT "ArenaSprint_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Trainee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaSprintAnswer" ADD CONSTRAINT "ArenaSprintAnswer_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "ArenaSprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaSprintAnswer" ADD CONSTRAINT "ArenaSprintAnswer_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaCredit" ADD CONSTRAINT "ArenaCredit_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaCredit" ADD CONSTRAINT "ArenaCredit_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
