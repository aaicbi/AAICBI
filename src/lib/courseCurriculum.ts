/**
 * Course catalogue upgrade — curriculum document upload, copying
 * src/lib/resume.ts's exact shape and allowed types/size cap (a
 * curriculum document is the same general kind of file as a résumé —
 * PDF/DOC/DOCX, reasonably up to 10MB).
 */
import { put, del } from "@vercel/blob";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateCurriculumFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only PDF, DOC, or DOCX files are allowed.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "File must be under 10MB.";
  }
  return null;
}

export async function uploadCurriculum(file: File, pathPrefix: string): Promise<string> {
  // Bug fix — see lessonMaterial.ts's identical fix: no `contentType`
  // and no extension in the pathname meant Blob stored this as
  // application/octet-stream instead of the real PDF/DOC type, so
  // opening the curriculum link force-downloaded it with an
  // unreadable filename instead of previewing/naming it properly —
  // the exact same bug reported for lesson materials.
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  // addRandomSuffix explicit — @vercel/blob 1.0.0+ defaults this to
  // false; this app still wants unguessable, collision-proof URLs.
  const blob = await put(`course-curricula/${pathPrefix}-${Date.now()}${extension}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });
  return blob.url;
}

export async function deleteCurriculumBestEffort(url: string): Promise<void> {
  await del(url).catch((err) => console.error("Failed to delete old course curriculum blob:", err));
}
