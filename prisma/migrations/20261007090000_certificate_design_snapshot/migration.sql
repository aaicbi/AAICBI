-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN "designSnapshot" JSONB;

-- Backfill: freeze every already-issued certificate at the design it
-- currently shows (approved template, else AAICBI's default), so no
-- later template change can alter it.
UPDATE "Certificate" c
SET "designSnapshot" = jsonb_build_object(
  'version', 1,
  'template', CASE
    WHEN t."id" IS NULL OR t."approvedAt" IS NULL THEN NULL
    ELSE jsonb_build_object(
      'trainingOrganizationId', t."trainingOrganizationId",
      'organizationName', o."name",
      'logoUrl', t."logoUrl",
      'signatoryName', t."signatoryName",
      'signatoryTitle', t."signatoryTitle",
      'primaryColor', t."primaryColor",
      'accentColor', t."accentColor",
      'layoutJson', t."layoutJson"
    )
  END
)
FROM "Course" co
LEFT JOIN "CertificateTemplate" t ON t."id" = co."certificateTemplateId"
LEFT JOIN "TrainingOrganization" o ON o."id" = t."trainingOrganizationId"
WHERE co."id" = c."courseId";
