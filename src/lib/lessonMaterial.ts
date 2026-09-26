/**
 * Lesson study material upload — PDF/DOCX/PPTX only (VIDEO materials
 * stay link-only; there's no file to host for a YouTube/Drive video).
 *
 * Bug fix: the file used to be proxied through this app's own API route
 * (a plain multipart POST, validated and re-uploaded to Blob server-
 * side). Vercel hard-caps every Serverless Function's request body at
 * 4.5MB — a platform limit, not anything this file's own MAX_SIZE_BYTES
 * controlled — so any real slide deck over that size failed with a
 * non-JSON 413 the frontend couldn't even show a real error for. Fixed
 * by switching to Vercel Blob's client-upload flow (see
 * src/app/api/lessons/[id]/materials/upload-token/route.ts and
 * src/app/api/materials/[id]/upload-token/route.ts): the browser
 * uploads the file directly to Blob using a short-lived token those
 * routes issue, so the file's bytes never pass through a Function at
 * all. `ALLOWED_TYPES`/`MAX_SIZE_BYTES` now feed those token routes'
 * `allowedContentTypes`/`maximumSizeInBytes` instead of a server-side
 * validation function — Blob itself enforces both against the token.
 */
import { del } from "@vercel/blob";

export const ALLOWED_TYPES: Record<"PDF" | "DOCX" | "PPTX", string[]> = {
  PDF: ["application/pdf"],
  DOCX: ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  PPTX: ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
};
export const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB — generous for a slide deck with embedded images, well under Blob's own limits

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
