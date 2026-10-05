import CertificateCard, { type CertificateCardProps } from "@/components/CertificateCard";
import CertificateLayoutRenderer from "@/components/CertificateLayoutRenderer";
import type { CertificateLayout } from "@/lib/certificateLayout";

/**
 * Visual Certificate Design Editor — the one router the three
 * certificate-rendering call sites go through, so none of them need
 * their own if/else: a template with layoutJson set renders the
 * designed layout, everything else renders the original, unchanged
 * CertificateCard.
 */
export default function CertificateDisplay({
  layoutJson,
  qrDataUrl,
  ...props
}: CertificateCardProps & { layoutJson?: CertificateLayout | null; qrDataUrl?: string }) {
  if (layoutJson) {
    return (
      <CertificateLayoutRenderer
        layout={layoutJson}
        logoUrl={props.branding?.logoUrl ?? null}
        qrDataUrl={qrDataUrl}
        traineeName={props.traineeName}
        verb={props.verb}
        credentialTitle={props.credentialTitle}
        issuedAt={props.issuedAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
        certificateCode={props.code}
        organizationName={props.branding?.organizationName ?? ""}
        signatoryName={props.branding?.signatoryName ?? ""}
        signatoryTitle={props.branding?.signatoryTitle ?? ""}
      />
    );
  }
  return <CertificateCard {...props} />;
}
