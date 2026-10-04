-- CreateTable
CREATE TABLE "MaterialPdfExport" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "convertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialPdfExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialPdfExport_materialId_key" ON "MaterialPdfExport"("materialId");

-- AddForeignKey
ALTER TABLE "MaterialPdfExport" ADD CONSTRAINT "MaterialPdfExport_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
