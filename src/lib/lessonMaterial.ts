/**
 * Lesson study material upload — PDF/DOCX/PPTX only (VIDEO materials
 * stay link-only; there's no file to host for a YouTube/Drive video).
 * Copies avatar.ts's validate/upload/delete-best-effort shape, extended
 * with one genuinely new consideration the other upload libs never
 * needed: a Material's url isn't always ours to delete. Unlike an
 * avatar or a course flyer — always either unset or a blob URL this
 * app itself created — a material's url can also be an admin-pasted
 * external link (a Drive-hosted document, say), and `del()` must never
 * be called against a URL this app doesn't own.
 */
import { put, del } from "@vercel/blob";

const ALLOWED_TYPES: Record<"PDF" | "DOCX" | "PPTX", string[]> = {
  PDF: ["application/pdf"],
  DOCX: ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  PPTX: ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
};
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB — generous for a slide deck with embedded images, still well under Blob's own limits

export function validateLessonMaterialFile(
  materialType: "PDF" | "DOCX" | "PPTX",
  file: { type: string; size: number }
): string | null {
  if (!ALLOWED_TYPES[materialType].includes(file.type)) {
    return `That file doesn't look like a ${materialType} — pick a matching file, or change the material type above.`;
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "File must be under 20MB.";
  }
  return null;
}

export async function uploadLessonMaterial(file: File, pathPrefix: string): Promise<string> {
  // Bug fix: neither an explicit `contentType` nor a file extension in
  // the pathname was ever passed to `put()`, so Blob had no way to
  // know this was a PDF/DOCX/PPTX and stored it as
  // application/octet-stream — which a browser can only ever download,
  // never preview inline, opening as a random-looking file with no
  // extension (the blob's own key) instead of the document itself.
  // `file.type` is exactly the real MIME type — already validated
  // against ALLOWED_TYPES above — so pass it straight through, and
  // keep the original extension in the pathname too as a second,
  // independent signal (matches how the sibling upload libs still
  // don't do this — see the note left on all of them together).
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  // addRandomSuffix explicit — see courseFlyer.ts's identical note:
  // @vercel/blob 1.0.0+ defaults this to false, but this app still
  // wants unguessable, collision-proof URLs.
  const blob = await put(`lesson-materials/${pathPrefix}-${Date.now()}${extension}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });
  return blob.url;
}

/** True only for a URL this app's own Blob store actually hosts — the
 * check that keeps deleteLessonMaterialBestEffort from ever attempting
 * to `del()` an admin-pasted external link (Drive, or anywhere else),
 * which isn't this app's to delete and isn't a real Blob URL to begin
 * with. */
export function isLessonMaterialBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function deleteLessonMaterialBestEffort(url: string): Promise<void> {
  if (!isLessonMaterialBlobUrl(url)) return;
  await del(url).catch((err) => console.error("Failed to delete old lesson material blob:", err));
}
