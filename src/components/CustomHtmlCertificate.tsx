import { renderCertificateHtml } from "@/lib/certificateHtmlTemplate";
import { sanitizeCertificateHtml } from "@/lib/certificateHtmlSanitize";
import type { CertificateCardProps } from "@/components/CertificateCard";

/**
 * Custom HTML Certificate Templates — renders an imported, instructor/
 * org-designed certificate body instead of the fixed CertificateCard
 * layout. Sanitized again here (on top of the PATCH route's own
 * save-time pass) because this is the one place that sanitized-but-
 * still-admin/org-authored markup reaches the public, unauthenticated
 * /certificate/[code] page — the highest-exposure surface this app has,
 * worth the small, non-hot-path cost of sanitizing twice.
 */
export default function CustomHtmlCertificate({
  html,
  traineeName,
  verb,
  credentialTitle,
  issuedAt,
  code,
  qrSvg,
  branding,
}: { html: string } & CertificateCardProps) {
  const rendered = renderCertificateHtml(html, {
    traineeName,
    verb,
    credentialTitle,
    issuedAt: issuedAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }),
    certificateCode: code,
    organizationName: branding?.organizationName ?? "",
    logoUrl: branding?.logoUrl ?? "",
    primaryColor: branding?.primaryColor ?? "#016B61",
    accentColor: branding?.accentColor ?? "#D99A34",
    signatoryName: branding?.signatoryName ?? "",
    signatoryTitle: branding?.signatoryTitle ?? "",
    qrCodeSvg: qrSvg ?? "",
  });
  const safeHtml = sanitizeCertificateHtml(rendered);

  return (
    <div
      className="relative overflow-hidden rounded-2xl print:border print:shadow-none animate-[modal-in_0.4s_ease-out]"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
