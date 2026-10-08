const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_BACKGROUND_BYTES = 10 * 1024 * 1024;

/** Null when the file can be used as an uploaded certificate design. */
export function validateCertificateBackgroundFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Only JPG, PNG, or WEBP images are allowed.";
  if (file.size > MAX_BACKGROUND_BYTES) return "Image must be under 10MB.";
  return null;
}
