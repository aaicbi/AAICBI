-- AlterTable
ALTER TABLE "ArenaConfig" ADD COLUMN "eventsEnabled" BOOLEAN;

-- AlterTable
ALTER TABLE "ArenaMatch" ADD COLUMN "eventId" TEXT,
ADD COLUMN "eventTieId" TEXT;

-- CreateTable
CREATE TABLE "ArenaEvent" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SIGNUP',
    "questionsPerMatch" INTEGER NOT NULL DEFAULT 10,
    "moduleId" TEXT,
    "createdById" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "championId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ArenaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaEventPlayer" (
    "eventId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaEventPlayer_pkey" PRIMARY KEY ("eventId","traineeId")
);

-- CreateTable
CREATE TABLE "ArenaEventTie" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "aId" TEXT,
    "bId" TEXT,
    "matchId" TEXT,
    "winnerId" TEXT,
    "bye" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "calledAt" TIMESTAMP(3),

    CONSTRAINT "ArenaEventTie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaSpectator" (
    "matchId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaSpectator_pkey" PRIMARY KEY ("matchId","traineeId")
);

-- CreateTable
CREATE TABLE "ArenaCheer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaCheer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArenaEvent_courseId_status_idx" ON "ArenaEvent"("courseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaEventTie_eventId_round_slot_key" ON "ArenaEventTie"("eventId", "round", "slot");

-- CreateIndex
CREATE INDEX "ArenaEventTie_matchId_idx" ON "ArenaEventTie"("matchId");

-- CreateIndex
CREATE INDEX "ArenaSpectator_matchId_lastSeenAt_idx" ON "ArenaSpectator"("matchId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "ArenaCheer_matchId_createdAt_idx" ON "ArenaCheer"("matchId", "createdAt");

-- AddForeignKey
ALTER TABLE "ArenaEvent" ADD CONSTRAINT "ArenaEvent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaEventPlayer" ADD CONSTRAINT "ArenaEventPlayer_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ArenaEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaEventPlayer" ADD CONSTRAINT "ArenaEventPlayer_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaEventTie" ADD CONSTRAINT "ArenaEventTie_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ArenaEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
