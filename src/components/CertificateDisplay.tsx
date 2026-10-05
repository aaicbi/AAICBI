import CertificateLayoutRenderer from "@/components/CertificateLayoutRenderer";
import type { CertificateLayout } from "@/lib/certificateLayout";
import { AAICBI_CLASSIC_PRESET } from "@/lib/certificatePresets";

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
   * design built yet" — renders the AAICBI Classic preset, the
   * platform-wide fallback. */
  layoutJson?: CertificateLayout | null;
}

/**
 * Visual Certificate Design Editor — the ONE rendering path every
 * certificate (real, preview, or review) goes through. The old
 * separate hardcoded CertificateCard component is gone; "AAICBI
 * Classic" is just one of several selectable presets now, same engine
 * as every training-org-branded design, so there's no second code path
 * that could ever visually drift from what the canvas editor produces.
 */
export default function CertificateDisplay({ layoutJson, qrDataUrl, branding, ...props }: CertificateDisplayProps) {
  const layout = layoutJson ?? AAICBI_CLASSIC_PRESET.layout;
  return (
    <CertificateLayoutRenderer
      layout={layout}
      logoUrl={branding?.logoUrl ?? null}
      qrDataUrl={qrDataUrl}
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
