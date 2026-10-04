/**
 * AI Assignment Engine — stores the original uploaded Word document for
 * audit/re-import (Assignment.sourceDocUrl), same three-function
 * validate/upload/delete-best-effort shape as avatar.ts and every other
 * Vercel Blob upload in this project.
 */
import { put, del } from "@vercel/blob";

const ALLOWED_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);

export function validateAssignmentDocFile(file: { type: string; size: number; name: string }): string | null {
  const looksLikeDocx = file.name.toLowerCase().endsWith(".docx");
  if (!ALLOWED_TYPES.includes(file.type) && !looksLikeDocx) {
    return "Invalid file. Please upload a Microsoft Word (.docx) document.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `File is too large. Maximum size is ${Math.round(MAX_SIZE_BYTES / 1024 / 1024)}MB.`;
  }
  return null;
}

export async function uploadAssignmentDoc(file: File, pathPrefix: string): Promise<string> {
  const blob = await put(`assignment-docs/${pathPrefix}-${Date.now()}.docx`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  return blob.url;
}

export async function deleteAssignmentDocBestEffort(url: string): Promise<void> {
  await del(url).catch((err) => console.error("Failed to delete assignment source document blob:", err));
}
