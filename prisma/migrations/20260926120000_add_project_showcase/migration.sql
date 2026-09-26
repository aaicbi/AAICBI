-- Pitch & Post, Phase 0 — one opt-in column so a trainee can list an
-- individual project on the public Community Showcase, independent of
-- their overall profile visibility. Purely additive; existing rows
-- default to not-listed.
ALTER TABLE "Project" ADD COLUMN "listedInShowcase" BOOLEAN NOT NULL DEFAULT false;
