import Logo from "@/components/Logo";
import Badge from "@/components/ui/Badge";
import AchievementDoodle from "@/components/doodles/AchievementDoodle";
import Icon from "@/components/ui/Icon";
import { VerifiedCredentialIcon } from "@/components/icons/brand";
import { hexToRgbTriple } from "@/lib/hexColor";

export interface CertificateCardProps {
  traineeName: string;
  verb: string;
  credentialTitle: string;
  issuedAt: Date;
  code: string;
  /** Omitted for a preview (the design tool's live preview and the
   * public template-review page, neither of which address a real,
   * issued certificate yet) — shows a plain placeholder square instead
   * of generating a QR code for a URL that doesn't exist yet. */
  qrSvg?: string;
  /** Present only for an organization-branded certificate — when set,
   * every prop below it also applies. Absent means AAICBI's own
   * unbranded default, byte-identical to this card's pre-Phase-1
   * rendering. */
  branding?: {
    organizationName: string;
    logoUrl: string | null;
    primaryColor: string;
    accentColor: string;
  };
}

/**
 * Training Organizations, Phase 1 — the certificate card's visual
 * layout, extracted out of src/app/certificate/[code]/page.tsx so the
 * SUPER_ADMIN design tool and the public template-review page can
 * render the exact same thing a real issued certificate will look
 * like, not an approximation. See that page's own comment for why the
 * CSS custom properties are re-pinned via inline `style` (a printed/
 * shared certificate can't have a dark mode) — `branding` swaps those
 * fixed values and the AAICBI mark/tagline for the organization's own,
 * and adds the non-removable "Powered by aaicbi.org" footer line.
 */
export default function CertificateCard({ traineeName, verb, credentialTitle, issuedAt, code, qrSvg, branding }: CertificateCardProps) {
  const teal = branding ? hexToRgbTriple(branding.primaryColor) : "1 107 97";
  const gold = branding ? hexToRgbTriple(branding.accentColor) : "217 154 52";

  return (
    <div
      style={
        {
          "--brand-ink": "22 48 43",
          "--brand-teal": teal,
          "--brand-gold": gold,
          "--brand-gold-light": "246 232 204",
          "--gray-400": "156 163 175",
          "--gray-500": "107 114 128",
          "--gray-600": "75 85 99",
        } as React.CSSProperties
      }
      className="relative overflow-hidden rounded-2xl border-2 border-brand-gold bg-gradient-to-b from-brand-goldLight/40 via-white to-white p-6 text-center shadow-sm print:border print:shadow-none animate-[modal-in_0.4s_ease-out] sm:p-10"
    >
      <AchievementDoodle className="pointer-events-none absolute left-1/2 top-0 h-32 w-32 -translate-x-1/2 -translate-y-4 opacity-90 sm:h-40 sm:w-40 sm:-translate-y-6" />

      <div className="relative pt-20 sm:pt-24">
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a real, dynamically-uploaded external URL, same reasoning as every other org-branded image in this app.
          <img src={branding.logoUrl} alt="" className="mx-auto h-11 w-11 object-contain sm:h-12 sm:w-12" />
        ) : (
          <Logo href={null} compact markClassName="h-11 w-11 sm:h-12 sm:w-12" className="justify-center" />
        )}
        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-brand-teal">
          {branding ? branding.organizationName : "Africa's AI Capacity Building Initiative"}
        </p>
        <p className="mt-6 text-sm text-gray-500">This certifies that</p>
        <p className="mt-2 font-display text-2xl font-semibold italic text-brand-ink sm:text-4xl">{traineeName}</p>
        <p className="mt-4 text-sm text-gray-500">{verb}</p>
        <p className="mt-2 font-display text-lg font-semibold text-brand-teal sm:text-xl">{credentialTitle}</p>

        <div className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8">
          <div className="text-center text-sm text-gray-600 sm:text-left">
            <p>
              <span className="font-semibold text-brand-ink">Issued:</span>{" "}
              {issuedAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-brand-ink">Certificate Code:</span> {code}
            </p>
          </div>
          {qrSvg ? (
            <div
              className="h-24 w-24 shrink-0 print:h-20 print:w-20"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              aria-label="QR code linking to this verification page"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-brand-gray text-[10px] text-gray-400">
              QR code
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-center">
          <Badge variant="gold">
            <Icon icon={VerifiedCredentialIcon} size="sm" className="mr-1 inline align-text-bottom" /> Verified by AAICBI
          </Badge>
        </div>

        {branding && <p className="mt-4 text-[10px] uppercase tracking-widest text-gray-400">Powered by aaicbi.org</p>}
      </div>
    </div>
  );
}
