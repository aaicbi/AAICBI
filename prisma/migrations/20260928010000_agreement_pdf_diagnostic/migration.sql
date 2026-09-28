-- Diagnostic-only column so a real attachment failure in production
-- can be read directly from the database instead of guessed at.
ALTER TABLE "InstructorAgreement" ADD COLUMN "pdfAttachmentError" TEXT;
