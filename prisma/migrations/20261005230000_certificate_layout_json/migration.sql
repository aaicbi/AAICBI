-- AlterTable
ALTER TABLE "CertificateTemplate" DROP COLUMN "customHtml",
ADD COLUMN "layoutJson" JSONB;
