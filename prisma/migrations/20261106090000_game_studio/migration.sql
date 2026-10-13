-- CreateEnum
CREATE TYPE "GameFormat" AS ENUM ('QUIZ', 'MATCHING', 'ORDERING', 'SCENARIO');

-- CreateEnum
CREATE TYPE "GameItemStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "format" "GameFormat" NOT NULL,
    "description" TEXT,
    "enabledRewards" TEXT[] DEFAULT ARRAY['ANSWER', 'MISSED_BONUS', 'STREAK', 'OBJECTIVE_MASTERED', 'MODULE_COMPLETED']::TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAssignment" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "live" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameItem" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "format" "GameFormat" NOT NULL,
    "content" JSONB NOT NULL,
    "status" "GameItemStatus" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "GameItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePlay" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "response" JSONB,
    "score" DOUBLE PRECISION,
    "correct" BOOLEAN,
    "secondsTaken" INTEGER,
    "tooFast" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GamePlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Game_format_idx" ON "Game"("format");

-- CreateIndex
CREATE INDEX "GameAssignment_moduleId_idx" ON "GameAssignment"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "GameAssignment_gameId_moduleId_key" ON "GameAssignment"("gameId", "moduleId");

-- CreateIndex
CREATE INDEX "GameItem_moduleId_format_status_idx" ON "GameItem"("moduleId", "format", "status");

-- CreateIndex
CREATE INDEX "GameItem_objectiveId_idx" ON "GameItem"("objectiveId");

-- CreateIndex
CREATE INDEX "GamePlay_traineeId_itemId_idx" ON "GamePlay"("traineeId", "itemId");

-- CreateIndex
CREATE INDEX "GamePlay_traineeId_moduleId_answeredAt_idx" ON "GamePlay"("traineeId", "moduleId", "answeredAt");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAssignment" ADD CONSTRAINT "GameAssignment_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAssignment" ADD CONSTRAINT "GameAssignment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameItem" ADD CONSTRAINT "GameItem_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameItem" ADD CONSTRAINT "GameItem_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "ModuleLearningObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlay" ADD CONSTRAINT "GamePlay_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlay" ADD CONSTRAINT "GamePlay_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlay" ADD CONSTRAINT "GamePlay_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlay" ADD CONSTRAINT "GamePlay_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GameItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Modules whose practice was already switched on before the studio existed keep working:
-- give each one a quiz game, assigned and live, so the studio shows it.
INSERT INTO "Game" ("id", "title", "format", "createdById", "updatedAt")
SELECT 'legacy-quiz-' || s."moduleId", 'Quiz practice: ' || m."title", 'QUIZ', u."id", CURRENT_TIMESTAMP
FROM "ModuleQuestSettings" s
JOIN "Module" m ON m."id" = s."moduleId"
CROSS JOIN LATERAL (SELECT "id" FROM "User" WHERE "role" = 'SUPER_ADMIN' ORDER BY "createdAt" LIMIT 1) u
WHERE s."practiceEnabled" = true;

INSERT INTO "GameAssignment" ("id", "gameId", "moduleId", "live")
SELECT 'legacy-assign-' || s."moduleId", 'legacy-quiz-' || s."moduleId", s."moduleId", true
FROM "ModuleQuestSettings" s
WHERE s."practiceEnabled" = true AND EXISTS (SELECT 1 FROM "Game" g WHERE g."id" = 'legacy-quiz-' || s."moduleId");
