/**
 * Custom HTML Certificate Templates — the `{{token}}` substitution
 * this feature's imported HTML is interpreted with. Pure function, no
 * Prisma/network, so the escaping/substitution rules are unit-testable
 * on their own (same split as every other *Core.ts-style file in this
 * project).
 *
 * Every text token is HTML-escaped except `qrCodeSvg` — the one
 * server-generated value, never admin/trainee-supplied, at the exact
 * same trust level CertificateCard.tsx already gives it via its own
 * `dangerouslySetInnerHTML`. A trainee's own `certificateName` is the
 * least-trusted value flowing through this path (the one field a
 * trainee controls that lands in admin/org-designed markup) — escaping
 * every other text token is what keeps that safe. An unrecognized
 * `{{token}}` is left untouched rather than silently dropped, so a
 * designer's typo is visible in preview instead of a silent gap in
 * production.
 */

// Mirrors notifications/templates.ts's own (module-private) escapeHtml
// exactly — small enough that duplicating it locally beats exporting a
// cross-cutting helper from an unrelated notifications file.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface CertificateTemplateData {
  traineeName: string;
  verb: string;
  credentialTitle: string;
  issuedAt: string;
  certificateCode: string;
  organizationName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  signatoryName: string;
  signatoryTitle: string;
  /** Raw, trusted SVG markup — the one field never escaped. */
  qrCodeSvg: string;
}

const RAW_TOKEN = "qrCodeSvg";

export function renderCertificateHtml(html: string, data: CertificateTemplateData): string {
  return html.replace(/\{\{(\w+)\}\}/g, (match, token: string) => {
    if (!(token in data)) return match;
    const value = data[token as keyof CertificateTemplateData];
    return token === RAW_TOKEN ? value : escapeHtml(value);
  });
}
