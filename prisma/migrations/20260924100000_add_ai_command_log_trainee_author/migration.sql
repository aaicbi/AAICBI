-- AlterTable: askedById loosened from required to optional so a
-- trainee-authored Loop turn (Learning Buddy persona) can leave it
-- null instead — every existing row already has a real value here, so
-- this is a safe, non-destructive direction (loosening, not tightening).
ALTER TABLE "AiCommandLog" ALTER COLUMN "askedById" DROP NOT NULL;

-- AlterTable: new, additive column for the trainee-authored case.
ALTER TABLE "AiCommandLog" ADD COLUMN "askedByTraineeId" TEXT;

-- CreateIndex
CREATE INDEX "AiCommandLog_askedByTraineeId_idx" ON "AiCommandLog"("askedByTraineeId");

-- AddForeignKey
ALTER TABLE "AiCommandLog" ADD CONSTRAINT "AiCommandLog_askedByTraineeId_fkey" FOREIGN KEY ("askedByTraineeId") REFERENCES "Trainee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
