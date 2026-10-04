/**
 * Course Material PDF Export — the lazy "check cache, else convert and
 * cache" orchestration for a DOCX material's PDF version. Kept out of
 * the download route itself so that route stays focused on access
 * control and HTTP response shaping. Mirrors
 * PerformanceSummary/AssignmentLearningInsight's own "one row per
 * source entity, upsert in place" convention, just triggered on read
 * instead of a domain event.
 */
import { prisma } from "@/lib/prisma";
import { resolveDownloadUrl } from "@/lib/materialUrl";
import { isPubliclyFetchableUrl } from "@/lib/ssrfGuard";
import { convertDocxToPdf } from "@/lib/docxToPdf";
import { uploadMaterialPdf, deleteMaterialPdfBestEffort } from "@/lib/materialPdfUpload";

export type MaterialPdfResult = { ok: true; pdfUrl: string } | { ok: false; status: number; error: string };

export interface MaterialForPdfExport {
  id: string;
  title: string;
  url: string;
  updatedAt: Date;
}

/**
 * Returns the cached PDF URL for this DOCX material, regenerating it
 * first if there's no cached row yet or the cached one is stale —
 * `sourceUpdatedAt` no longer matches the material's current
 * `updatedAt`, meaning the instructor replaced or edited it since the
 * last conversion. The old blob is best-effort deleted once a fresh
 * one is uploaded, so a repeatedly-edited material never leaks
 * orphaned PDF blobs.
 */
export async function getOrCreateMaterialPdfUrl(material: MaterialForPdfExport): Promise<MaterialPdfResult> {
  const existing = await prisma.materialPdfExport.findUnique({ where: { materialId: material.id } });
  if (existing && existing.sourceUpdatedAt.getTime() === material.updatedAt.getTime()) {
    return { ok: true, pdfUrl: existing.pdfUrl };
  }

  const downloadUrl = resolveDownloadUrl(material.url);
  if (!(await isPubliclyFetchableUrl(downloadUrl))) {
    console.error(`Refused to fetch material ${material.id} for PDF export: URL does not resolve to a public address.`);
    return { ok: false, status: 415, error: "This material isn't available for PDF export." };
  }

  let upstream: Response;
  try {
    upstream = await fetch(downloadUrl);
  } catch (e) {
    console.error(`PDF export fetch failed for material ${material.id}:`, e);
    return { ok: false, status: 502, error: "Could not fetch this material right now." };
  }
  if (!upstream.ok) {
    return { ok: false, status: 502, error: "Could not fetch this material right now." };
  }
  const contentType = upstream.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    return { ok: false, status: 415, error: "This material isn't available for PDF export." };
  }

  const originalBuffer = Buffer.from(await upstream.arrayBuffer());
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await convertDocxToPdf(originalBuffer, material.title);
  } catch (e) {
    console.error(`DOCX-to-PDF conversion failed for material ${material.id}:`, e);
    return { ok: false, status: 502, error: "Could not convert this material to PDF right now." };
  }

  let pdfUrl: string;
  try {
    pdfUrl = await uploadMaterialPdf(pdfBuffer, material.id);
  } catch (e) {
    // Never let a storage-provider error message reach the trainee —
    // same "don't leak internal service details" discipline this
    // codebase applies everywhere else (e.g. the generic 401 on a bad
    // cron secret never confirming which part failed).
    console.error(`PDF upload failed for material ${material.id}:`, e);
    return { ok: false, status: 502, error: "Could not store the converted PDF right now." };
  }
  if (existing) await deleteMaterialPdfBestEffort(existing.pdfUrl);

  await prisma.materialPdfExport.upsert({
    where: { materialId: material.id },
    create: { materialId: material.id, pdfUrl, sourceUpdatedAt: material.updatedAt },
    update: { pdfUrl, sourceUpdatedAt: material.updatedAt, convertedAt: new Date() },
  });

  return { ok: true, pdfUrl };
}
