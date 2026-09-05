import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { certificateQrCodeSvg } from "@/lib/certificateQr";
import { appUrl } from "@/lib/appUrl";
import SiteHeader from "@/components/SiteHeader";
import Logo from "@/components/Logo";
import PrintCertificateButton from "@/components/PrintCertificateButton";
import Badge from "@/components/ui/Badge";
import AchievementDoodle from "@/components/doodles/AchievementDoodle";

/**
 * M15 — the public certificate verification page. No authentication —
 * that's the whole point: anyone with a certificate code (or its QR
 * code) can confirm it's real without logging in, which is what "a
 * signed record plus a public verification URL" (the roadmap's own
 * phrasing) actually means in practice. See the schema comment on
 * Certificate for why this is a database lookup, not a cryptographic
 * proof — the record's authenticity IS the lookup.
 *
 * Redesigned as this project's UI/UX pass's flagship page — this is
 * the single moment in the whole platform meant to feel like a genuine
 * achievement, not just a confirmation screen. Fraunces (this app's
 * one display serif, used sparingly everywhere else) carries the
 * trainee's name and the course title; the achievement doodle and a
 * gold accent are used here specifically because gold is reserved
 * across this whole redesign for exactly this moment, nowhere else —
 * see Card.tsx's own comment on why that restraint matters.
 *
 * Deliberately shows only what a verifier needs: trainee name, course
 * title, issue date, the code itself. Never the trainee's email or any
 * other account detail — this page has no session to gate that with,
 * so nothing sensitive is fetched for it in the first place, not just
 * hidden in the render.
 *
 * Rate-limited by IP (60/hour) — generous enough that a real person
 * verifying a real certificate never notices it, present specifically
 * to blunt a scripted attempt to enumerate codes. The code space itself
 * (8 random alphanumeric characters from a 32-symbol alphabet) already
 * makes blind guessing impractical; this is defense in depth, the same
 * posture every other public-facing endpoint in this project takes.
 */
export default async function CertificateVerificationPage({ params }: { params: { code: string } }) {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await rateLimit(`certificate-verify:${ip}`, 60, 60 * 60 * 1000);

  const nav = [{ label: "Verify a Certificate", href: "/certificate" }];

  if (!allowed) {
    return (
      <>
        <SiteHeader nav={nav} />
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <p className="text-gray-600">Too many verification requests from this connection. Please try again in a few minutes.</p>
        </main>
      </>
    );
  }

  const certificate = await prisma.certificate.findUnique({
    where: { code: params.code.toUpperCase() },
    select: {
      code: true,
      issuedAt: true,
      revokedAt: true,
      trainee: { select: { name: true } },
      course: { select: { title: true, description: true } },
    },
  });

  if (!certificate) {
    return (
      <>
        <SiteHeader nav={nav} />
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <div className="rounded-2xl border border-brand-roseLight bg-brand-roseLight/40 p-8">
            <p className="text-3xl" aria-hidden="true">✕</p>
            <p className="mt-3 font-display text-lg font-semibold text-brand-rose">Certificate Not Found</p>
            {/* Audit finding, closed here: hardcoded hex, same pattern
                already fixed on the public profile page — see that
                page's own comment for the full reasoning. */}
            <p className="mt-2 text-sm text-brand-rose">
              The code &quot;{params.code}&quot; doesn&apos;t match any certificate issued by AAICBI. Check the code and try
              again.
            </p>
          </div>
        </main>
      </>
    );
  }

  if (certificate.revokedAt) {
    return (
      <>
        <SiteHeader nav={nav} />
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <div className="rounded-2xl border border-brand-goldLight bg-brand-goldLight/50 p-8">
            <p className="text-3xl">⚠</p>
            {/* Audit finding, closed here: same hardcoded-hex pattern
                as the rose case above, now for gold — see
                `brand-gold-text`'s own schema comment for why a
                dedicated, darker text shade was needed rather than
                reusing `brand-gold` itself, which is tuned to be a
                vibrant accent, not necessarily legible body text. */}
            <p className="mt-3 font-display text-lg font-semibold text-brand-goldText">Certificate Revoked</p>
            <p className="mt-2 text-sm text-brand-goldText">
              This certificate ({certificate.code}) was issued by AAICBI but has since been revoked and is no longer
              valid.
            </p>
          </div>
        </main>
      </>
    );
  }

  const verificationUrl = appUrl(`/certificate/${certificate.code}`);
  const qrSvg = await certificateQrCodeSvg(verificationUrl);

  return (
    <>
      <SiteHeader nav={nav} />
      <main className="mx-auto max-w-2xl px-6 py-12 print:py-4">
        <div
          className="relative overflow-hidden rounded-2xl border-2 border-brand-gold bg-gradient-to-b from-brand-goldLight/40 via-white to-white p-6 text-center shadow-sm print:border print:shadow-none animate-[modal-in_0.4s_ease-out] sm:p-10"
        >
          {/* The achievement doodle sits behind the content, quiet enough
              not to compete with the name and course title — the one
              genuinely decorative flourish in this whole redesign,
              earned by being reserved for this exact moment. */}
          <AchievementDoodle className="pointer-events-none absolute left-1/2 top-0 h-32 w-32 -translate-x-1/2 -translate-y-4 opacity-90 sm:h-40 sm:w-40 sm:-translate-y-6" />

          <div className="relative pt-20 sm:pt-24">
            {/* The logo belongs to the certificate DOCUMENT itself, not
                just the page around it — SiteHeader above already has
                the mark, but a printed or shared/screenshotted
                certificate never includes that header, only this card.
                Without this, the actual credential someone downloads or
                posts to LinkedIn would carry no AAICBI branding at all. */}
            <Logo href={null} compact markClassName="h-11 w-11 sm:h-12 sm:w-12" className="justify-center" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-brand-teal">
              Africa&apos;s AI Capacity Building Initiative
            </p>
            <p className="mt-6 text-sm text-gray-500">This certifies that</p>
            <p className="mt-2 font-display text-2xl font-semibold italic text-brand-ink sm:text-4xl">
              {certificate.trainee.name}
            </p>
            <p className="mt-4 text-sm text-gray-500">has successfully completed</p>
            <p className="mt-2 font-display text-lg font-semibold text-brand-teal sm:text-xl">
              {certificate.course.title}
            </p>

            {/* Responsiveness fix: this used to be a fixed
                flex-row with no stacking — on a real phone width,
                the fixed 96px QR code left barely 120px for the
                "Issued"/"Certificate Code" text next to it, which
                would wrap illegibly. Stacks on mobile, sits side by
                side once there's room for it. */}
            <div className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8">
              <div className="text-center text-sm text-gray-600 sm:text-left">
                <p>
                  <span className="font-semibold text-brand-ink">Issued:</span>{" "}
                  {certificate.issuedAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-brand-ink">Certificate Code:</span> {certificate.code}
                </p>
              </div>
              <div
                className="h-24 w-24 shrink-0 print:h-20 print:w-20"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
                aria-label="QR code linking to this verification page"
              />
            </div>

            <div className="mt-8 flex justify-center">
              <Badge variant="gold">✓ Verified by AAICBI</Badge>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400 print:hidden">
          Anyone with this link can verify this certificate is genuine — no login required.
        </p>
        <div className="mt-4 text-center print:hidden">
          <PrintCertificateButton />
        </div>
      </main>
    </>
  );
}
