-- Gaming Arena matches (additive). Rollback:
-- DROP TABLE "ArenaPresence"; DROP TABLE "ArenaReaction"; DROP TABLE "ArenaMessage"; DROP TABLE "ArenaRound"; DROP TABLE "ArenaMatch";
-- DROP TYPE "ArenaPhase"; DROP TYPE "ArenaMatchStatus";

CREATE TYPE "ArenaMatchStatus" AS ENUM ('PENDING', 'LOBBY', 'ACTIVE', 'COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'FORFEITED');
CREATE TYPE "ArenaPhase" AS ENUM ('PICK', 'ANSWER', 'STEAL', 'REVEAL');

CREATE TABLE "ArenaMatch" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "moduleId" TEXT,
    "challengerId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "status" "ArenaMatchStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rules" JSONB NOT NULL,
    "readyChallenger" BOOLEAN NOT NULL DEFAULT false,
    "readyOpponent" BOOLEAN NOT NULL DEFAULT false,
    "phase" "ArenaPhase",
    "phaseEndsAt" TIMESTAMP(3),
    "roundNo" INTEGER NOT NULL DEFAULT 0,
    "turnId" TEXT,
    "scoreChallenger" INTEGER NOT NULL DEFAULT 0,
    "scoreOpponent" INTEGER NOT NULL DEFAULT 0,
    "missChallenger" INTEGER NOT NULL DEFAULT 0,
    "missOpponent" INTEGER NOT NULL DEFAULT 0,
    "pausedById" TEXT,
    "pausedAt" TIMESTAMP(3),
    "pauseRemainingMs" INTEGER,
    "pausesUsedChallenger" INTEGER NOT NULL DEFAULT 0,
    "pausesUsedOpponent" INTEGER NOT NULL DEFAULT 0,
    "winnerId" TEXT,
    "endReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArenaRound" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "pickerId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "format" "GameFormat" NOT NULL,
    "itemKind" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "basePoints" INTEGER NOT NULL,
    "served" JSONB NOT NULL,
    "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstResponse" JSONB,
    "firstCorrect" BOOLEAN,
    "firstTimedOut" BOOLEAN NOT NULL DEFAULT false,
    "firstAt" TIMESTAMP(3),
    "stealerId" TEXT,
    "stealResponse" JSONB,
    "stealCorrect" BOOLEAN,
    "stealTimedOut" BOOLEAN NOT NULL DEFAULT false,
    "stealAt" TIMESTAMP(3),
    "outcome" TEXT,
    "awardedToId" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "reveal" JSONB,

    CONSTRAINT "ArenaRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArenaMessage" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArenaReaction" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArenaPresence" (
    "traineeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaPresence_pkey" PRIMARY KEY ("traineeId","courseId")
);

CREATE INDEX "ArenaMatch_courseId_status_idx" ON "ArenaMatch"("courseId", "status");
CREATE INDEX "ArenaMatch_challengerId_status_idx" ON "ArenaMatch"("challengerId", "status");
CREATE INDEX "ArenaMatch_opponentId_status_idx" ON "ArenaMatch"("opponentId", "status");
CREATE UNIQUE INDEX "ArenaRound_matchId_idx_key" ON "ArenaRound"("matchId", "idx");
CREATE UNIQUE INDEX "ArenaRound_matchId_number_key" ON "ArenaRound"("matchId", "number");
CREATE INDEX "ArenaMessage_matchId_createdAt_idx" ON "ArenaMessage"("matchId", "createdAt");
CREATE INDEX "ArenaReaction_matchId_createdAt_idx" ON "ArenaReaction"("matchId", "createdAt");
CREATE INDEX "ArenaPresence_courseId_lastSeenAt_idx" ON "ArenaPresence"("courseId", "lastSeenAt");

ALTER TABLE "ArenaMatch" ADD CONSTRAINT "ArenaMatch_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArenaMatch" ADD CONSTRAINT "ArenaMatch_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArenaMatch" ADD CONSTRAINT "ArenaMatch_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArenaRound" ADD CONSTRAINT "ArenaRound_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "ArenaMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArenaMessage" ADD CONSTRAINT "ArenaMessage_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "ArenaMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArenaReaction" ADD CONSTRAINT "ArenaReaction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "ArenaMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArenaPresence" ADD CONSTRAINT "ArenaPresence_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArenaPresence" ADD CONSTRAINT "ArenaPresence_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
