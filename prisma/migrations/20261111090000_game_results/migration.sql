ALTER TABLE "PlatformSettings" ADD COLUMN "gameResultsShared" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "FeedGamePlay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "assignmentId" TEXT,
    "gameId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedGamePlay_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedGamePlay_userId_answeredAt_idx" ON "FeedGamePlay"("userId", "answeredAt");
CREATE INDEX "FeedGamePlay_gameId_answeredAt_idx" ON "FeedGamePlay"("gameId", "answeredAt");
CREATE INDEX "FeedGamePlay_moduleId_answeredAt_idx" ON "FeedGamePlay"("moduleId", "answeredAt");
