import CertificateCard, { type CertificateCardProps } from "@/components/CertificateCard";
import CustomHtmlCertificate from "@/components/CustomHtmlCertificate";

/**
 * Custom HTML Certificate Templates — the one router the three
 * existing certificate-rendering call sites go through, so none of
 * them need their own if/else: a template with customHtml set renders
 * the imported design, everything else renders the original,
 * unchanged CertificateCard.
 */
export default function CertificateDisplay({
  customHtml,
  ...props
}: CertificateCardProps & { customHtml?: string | null }) {
  if (customHtml) {
    return <CustomHtmlCertificate html={customHtml} {...props} />;
  }
  return <CertificateCard {...props} />;
}
