-- The name a trainee asked to have printed on their certificate,
-- captured at the moment they started a certificate-eligible attempt.
ALTER TABLE "Attempt" ADD COLUMN "certificateName" TEXT;
