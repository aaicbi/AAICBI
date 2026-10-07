import CertificateLayoutRenderer from "@/components/CertificateLayoutRenderer";
import CertificateCard from "@/components/CertificateCard";
import type { CertificateLayout } from "@/lib/certificateLayout";

export interface CertificateDisplayProps {
  traineeName: string;
  verb: string;
  credentialTitle: string;
  issuedAt: Date;
  code: string;
  /** Undefined for a preview (no real certificate exists yet) — the
   * renderer shows a plain placeholder box instead of a QR code. */
  qrDataUrl?: string;
  branding?: {
    organizationName: string;
    logoUrl: string | null;
    signatoryName?: string | null;
    signatoryTitle?: string | null;
  };
  /** Null/undefined means "no template assigned, or a template with no
   * design built yet" — renders the original default certificate
   * design (CertificateCard), the platform-wide fallback. */
  layoutJson?: CertificateLayout | null;
  /** Required — see CertificateLayoutRenderer's own prop comment for
   * why this is never optional/defaulted. */
  showWatermark: boolean;
}

/**
 * The ONE place certificates are rendered. A custom canvas design
 * (layoutJson) goes through the layout engine; everything else gets the
 * original default design, as it looked before the canvas editor.
 * "AAICBI Classic" stays a selectable starting preset in the editor
 * only — it is not the fallback.
 */
export default function CertificateDisplay({ layoutJson, qrDataUrl, branding, showWatermark, ...props }: CertificateDisplayProps) {
  if (!layoutJson) {
    return (
      <CertificateCard
        traineeName={props.traineeName}
        verb={props.verb}
        credentialTitle={props.credentialTitle}
        issuedAt={props.issuedAt}
        code={props.code}
        qrDataUrl={qrDataUrl}
        showWatermark={showWatermark}
        branding={
          branding
            ? {
                organizationName: branding.organizationName,
                logoUrl: branding.logoUrl,
                primaryColor: "#016B61",
                accentColor: "#D99A34",
                signatoryName: branding.signatoryName,
                signatoryTitle: branding.signatoryTitle,
              }
            : undefined
        }
      />
    );
  }
  return (
    <CertificateLayoutRenderer
      layout={layoutJson}
      logoUrl={branding?.logoUrl ?? null}
      qrDataUrl={qrDataUrl}
      showWatermark={showWatermark}
      traineeName={props.traineeName}
      verb={props.verb}
      credentialTitle={props.credentialTitle}
      issuedAt={props.issuedAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
      certificateCode={props.code}
      organizationName={branding?.organizationName ?? "Africa's AI Capacity Building Initiative"}
      signatoryName={branding?.signatoryName ?? ""}
      signatoryTitle={branding?.signatoryTitle ?? ""}
    />
  );
}
