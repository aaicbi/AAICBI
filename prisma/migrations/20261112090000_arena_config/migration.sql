-- Gaming Arena switches and rules, one row per scope (platform, organization, course).
-- Additive only. Rollback: DROP TABLE "ArenaConfig"; DROP TYPE "ArenaSpectators"; DROP TYPE "ArenaScopeType";

CREATE TYPE "ArenaScopeType" AS ENUM ('PLATFORM', 'ORGANIZATION', 'COURSE');
CREATE TYPE "ArenaSpectators" AS ENUM ('OFF', 'ENROLLED', 'LIVE');

CREATE TABLE "ArenaConfig" (
    "id" TEXT NOT NULL,
    "scopeType" "ArenaScopeType" NOT NULL,
    "scopeId" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN,
    "gameEnabled" BOOLEAN,
    "chatEnabled" BOOLEAN,
    "ladderEnabled" BOOLEAN,
    "spectators" "ArenaSpectators",
    "spectatorCap" INTEGER,
    "questionSeconds" INTEGER,
    "pickSeconds" INTEGER,
    "bonusPercent" INTEGER,
    "pausesPerPlayer" INTEGER,
    "pauseSeconds" INTEGER,
    "questionsPerMatch" INTEGER,
    "tickingSound" BOOLEAN,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArenaConfig_scopeType_scopeId_key" ON "ArenaConfig"("scopeType", "scopeId");
