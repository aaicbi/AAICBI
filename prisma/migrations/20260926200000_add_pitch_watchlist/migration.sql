-- Pitch & Post — investor "save for later" watchlist. Purely
-- additive: one new join table, no existing columns touched.

CREATE TABLE "PitchWatchlistItem" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "pitchSubmissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PitchWatchlistItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PitchWatchlistItem_investorId_pitchSubmissionId_key" ON "PitchWatchlistItem"("investorId", "pitchSubmissionId");

ALTER TABLE "PitchWatchlistItem" ADD CONSTRAINT "PitchWatchlistItem_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PitchWatchlistItem" ADD CONSTRAINT "PitchWatchlistItem_pitchSubmissionId_fkey" FOREIGN KEY ("pitchSubmissionId") REFERENCES "PitchSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
