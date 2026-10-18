-- CreateTable
CREATE TABLE "ArenaPreference" (
    "traineeId" TEXT NOT NULL,
    "challengeMutedUntil" TIMESTAMP(3),
    "challengeMuted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaPreference_pkey" PRIMARY KEY ("traineeId")
);

-- AddForeignKey
ALTER TABLE "ArenaPreference" ADD CONSTRAINT "ArenaPreference_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
