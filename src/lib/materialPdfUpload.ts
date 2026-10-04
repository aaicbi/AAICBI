/**
 * Course Material PDF Export — stores the lazily-converted PDF for a
 * DOCX material (MaterialPdfExport.pdfUrl). Same put()/del() shape as
 * every other Vercel Blob upload in this project (assignmentDocUpload.ts,
 * lessonMaterial.ts), adapted to upload a generated Buffer rather than
 * a client-provided File.
 */
import { put, del } from "@vercel/blob";

export async function uploadMaterialPdf(pdf: Buffer, materialId: string): Promise<string> {
  const blob = await put(`material-pdf-exports/${materialId}-${Date.now()}.pdf`, pdf, {
    access: "public",
    addRandomSuffix: true,
    contentType: "application/pdf",
  });
  return blob.url;
}

export async function deleteMaterialPdfBestEffort(url: string): Promise<void> {
  await del(url).catch((err) => console.error("Failed to delete material PDF export blob:", err));
}
