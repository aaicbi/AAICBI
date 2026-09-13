/**
 * Universal profile system, Phase 6 — resume/CV upload, copying
 * src/lib/avatar.ts's exact three-function shape (validate/upload/
 * delete-best-effort) with different allowed types and a larger size
 * cap appropriate for a document rather than an image.
 */
import { put, del } from "@vercel/blob";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB — a resume can reasonably include images/formatting a plain profile picture wouldn't

export function validateResumeFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only PDF, DOC, or DOCX files are allowed.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "File must be under 10MB.";
  }
  return null;
}

export async function uploadResume(file: File, pathPrefix: string): Promise<string> {
  // addRandomSuffix explicit — @vercel/blob 1.0.0+ defaults this to
  // false; this app still wants unguessable, collision-proof URLs.
  const blob = await put(`resumes/${pathPrefix}-${Date.now()}`, file, { access: "public", addRandomSuffix: true });
  return blob.url;
}

export async function deleteResumeBestEffort(url: string): Promise<void> {
  await del(url).catch((err) => console.error("Failed to delete old resume blob:", err));
}
