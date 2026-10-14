-- AI-generated bank questions that are not yet fully approved must keep needsReview = true (that is what keeps them out of
-- exams until they pass both gates). The Assessment page's "Approve as-is" used to clear the flag without moving the question
-- through the bank, leaving questions that were live in exams but counted as unapproved by the bank, the studio and practice.
-- This puts the flag back for exactly those questions; they then show up again on the Question bank page for review.
UPDATE "Question"
SET "needsReview" = true
WHERE "bankStatus" IN ('PENDING_REVIEW', 'PENDING_VALIDATION', 'VALIDATED_PASS', 'VALIDATED_WARNING', 'VALIDATED_FLAGGED', 'VALIDATED_REJECTED')
  AND "needsReview" = false;
