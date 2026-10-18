-- AlterTable
ALTER TABLE "ArenaMatch" ADD COLUMN "rematchOfId" TEXT;

-- CreateIndex
CREATE INDEX "ArenaMatch_rematchOfId_idx" ON "ArenaMatch"("rematchOfId");
