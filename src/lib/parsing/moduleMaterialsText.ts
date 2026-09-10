/**
 * Loop Question Bank — the one place that turns "a module's lesson
 * materials" into plain text an AI generation/objective-drafting call
 * can actually read. DOCX-only for now, a deliberate scope cut (not an
 * oversight): `mammoth` (docxParser.ts) is already a proven dependency
 * here; PDF, PPTX, and VIDEO materials are all skipped with an honest
 * reason rather than silently dropped, so the admin/Loop conversation
 * can say plainly "2 of 5 materials could be analyzed."
 *
 * Fetches each DOCX material's bytes the exact same safe way
 * src/app/api/materials/[id]/download/route.ts already does — resolve
 * the real download URL (materialUrl.ts, handling the Google Drive
 * viewer-link special case), refuse anything that doesn't resolve to a
 * genuinely public address (ssrfGuard.ts), and treat a non-ok response
 * or an HTML content-type as "not fetchable" rather than throwing. A
 * material's `url` is staff-provided, not this server's own code — the
 * same lower trust boundary that route's own comment explains.
 */
import { prisma } from "@/lib/prisma";
import { resolveDownloadUrl } from "@/lib/materialUrl";
import { isPubliclyFetchableUrl } from "@/lib/ssrfGuard";
import { extractTextFromDocx, DocxParseError } from "@/lib/parsing/docxParser";
import type { MaterialType } from "@prisma/client";

export interface UsableMaterialText {
  materialId: string;
  title: string;
  text: string;
}

export interface SkippedMaterial {
  materialId: string;
  title: string;
  reason: string;
}

export interface ModuleMaterialsTextResult {
  usable: UsableMaterialText[];
  skipped: SkippedMaterial[];
}

const UNSUPPORTED_TYPE_REASON: Record<"PDF" | "PPTX" | "VIDEO", string> = {
  PDF: "PDF materials aren't supported for AI analysis yet.",
  PPTX: "PowerPoint materials aren't supported for AI analysis yet.",
  VIDEO: "Video materials aren't supported for AI analysis yet.",
};

/**
 * Pure dispatch: null means "DOCX, proceed to fetch it"; a string is
 * the exact skip reason for any other material type. Split out from
 * the loop below specifically so this dispatch decision — the thing
 * that guarantees a PDF/PPTX/VIDEO material never triggers a network
 * fetch at all — is unit-testable without Prisma or a real fetch.
 */
export function getUnsupportedMaterialTypeReason(type: MaterialType): string | null {
  if (type === "DOCX") return null;
  return UNSUPPORTED_TYPE_REASON[type];
}

/**
 * Walks Module -> Lesson[] -> Material[] and returns both the usable
 * extracted text and an honest, per-material reason for anything that
 * couldn't be used — never a silent gap. DOCX-only: every non-DOCX
 * material is skipped before any network attempt is made at all.
 */
export async function getModuleMaterialsText(moduleId: string): Promise<ModuleMaterialsTextResult> {
  const materials = await prisma.material.findMany({
    where: { lesson: { moduleId } },
    select: { id: true, title: true, type: true, url: true },
    orderBy: [{ lesson: { order: "asc" } }, { order: "asc" }],
  });

  const usable: UsableMaterialText[] = [];
  const skipped: SkippedMaterial[] = [];

  for (const material of materials) {
    const unsupportedReason = getUnsupportedMaterialTypeReason(material.type);
    if (unsupportedReason) {
      skipped.push({ materialId: material.id, title: material.title, reason: unsupportedReason });
      continue;
    }

    const downloadUrl = resolveDownloadUrl(material.url);
    if (!(await isPubliclyFetchableUrl(downloadUrl))) {
      skipped.push({ materialId: material.id, title: material.title, reason: "This material's link isn't reachable for analysis." });
      continue;
    }

    let upstream: Response;
    try {
      upstream = await fetch(downloadUrl);
    } catch {
      skipped.push({ materialId: material.id, title: material.title, reason: "Could not download this material to analyze it." });
      continue;
    }
    if (!upstream.ok || !upstream.body) {
      skipped.push({ materialId: material.id, title: material.title, reason: "Could not download this material to analyze it." });
      continue;
    }
    const contentType = upstream.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      skipped.push({
        materialId: material.id,
        title: material.title,
        reason: "This material isn't available for analysis (its link doesn't point to a real file).",
      });
      continue;
    }

    try {
      const buffer = Buffer.from(await upstream.arrayBuffer());
      const text = await extractTextFromDocx(buffer);
      usable.push({ materialId: material.id, title: material.title, text });
    } catch (e) {
      skipped.push({
        materialId: material.id,
        title: material.title,
        reason: e instanceof DocxParseError ? e.message : "Could not read this document's content.",
      });
    }
  }

  return { usable, skipped };
}
