/**
 * Training Organizations, Phase 1 — the certificate template share-link
 * token. Same restricted alphabet and PREFIX-XXXX-XXXX shape as
 * generateCertificateCode() (src/lib/certificates.ts) and
 * generateProfileCode() (src/app/api/trainee/public-profile/route.ts)
 * — this codebase's established convention is a local copy of this
 * same ~6-line snippet per call site with its own prefix, not a shared
 * exported helper, so this follows suit rather than inventing a new
 * scheme. Own prefix ("CERTTPL") so a bare code string is
 * self-describing about which kind of link it is.
 */
import { randomBytes } from "crypto";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // excludes 0/O, 1/I/L

export function generateTemplateReviewToken(): string {
  const bytes = randomBytes(8);
  let raw = "";
  for (const b of bytes) raw += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `CERTTPL-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}
