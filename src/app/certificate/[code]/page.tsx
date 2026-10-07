import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { certificateQrCodeDataUrl } from "@/lib/certificateQr";
import { appUrl } from "@/lib/appUrl";
import type { CertificateLayout } from "@/lib/certificateLayout";
import { shouldShowCertWatermark } from "@/lib/trainingOrgBilling";
import { parseCertificateDesignSnapshot } from "@/lib/certificateDesignSnapshot";
import SiteHeader from "@/components/SiteHeader";
import PrintCertificateButton from "@/components/PrintCertificateButton";
import CertificateDisplay from "@/components/CertificateDisplay";
import { XCircle, AlertTriangle } from "lucide-react";
import Icon from "@/components/ui/Icon";

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

  const courseCertificate = await prisma.certificate.findUnique({
    where: { code: params.code.toUpperCase() },
    select: {
      code: true,
      issuedAt: true,
      revokedAt: true,
      // A certificate's design is frozen at the moment it's issued (see
      // certificateDesignSnapshot.ts) — never redrawn from the course's
      // CURRENT template, so re-assigning or editing a template later
      // can't retroactively redesign a certificate already handed out.
      // Only a row issued before this column existed (backfilled by its
      // own migration, so should only ever be seen mid-deploy) falls
      // back to reading the live template below.
      designSnapshot: true,
      trainee: { select: { name: true } },
      course: {
        select: {
          title: true,
          description: true,
          // Training Organizations, Phase 1 — the org admin's own
          // chosen template for this course, if any (see Course.
          // certificateTemplateId's own schema comment). Only
          // included so the render below can branch on it; an
          // unapproved template is never used even if assigned. Still
          // selected (not just the snapshot) for the pre-snapshot
          // fallback path above.
          certificateTemplate: {
            select: {
              trainingOrganizationId: true,
              logoUrl: true,
              approvedAt: true,
              layoutJson: true,
              signatoryName: true,
              signatoryTitle: true,
              trainingOrganization: { select: { name: true } },
            },
          },
        },
      },
      // The name the trainee confirmed when they started the course
      // examination — see Attempt.certificateName's own schema
      // comment. Null for a certificate issued before this field
      // existed, or a genuinely old attempt row; trainee.name is the
      // honest fallback for those, not a hard requirement.
      courseExamAttempt: { select: { certificateName: true } },
    },
  });

  // Standalone-exam certificates share the exact same code format/
  // alphabet (generateCertificateCode) and the same public-verification
  // idea, so this one page serves both — see ExamCertificate's own
  // schema comment for why it's a separate table rather than a
  // generalized Certificate. Normalized into the same shape the render
  // below already expects, with "passed" instead of "completed" (a
  // standalone exam has no modules to complete, just a pass/fail).
  const examCertificateRow = courseCertificate
    ? null
    : await prisma.examCertificate.findUnique({
        where: { code: params.code.toUpperCase() },
        select: {
          code: true,
          issuedAt: true,
          revokedAt: true,
          trainee: { select: { name: true } },
          exam: { select: { title: true } },
          examAttempt: { select: { certificateName: true } },
        },
      });

  // The design this certificate was actually ISSUED with — never the
  // course's current template (see designSnapshot's own schema
  // comment). `snapshot.template === null` is a real, distinct state
  // ("issued with AAICBI's own default design"), not the same as no
  // snapshot existing at all (a pre-migration row, which falls back to
  // the live template exactly as this page always did).
  const snapshot = parseCertificateDesignSnapshot(courseCertificate?.designSnapshot);
  const liveTemplate = courseCertificate?.course.certificateTemplate;
  const designTemplate = snapshot
    ? snapshot.template
    : liveTemplate && liveTemplate.approvedAt
      ? {
          trainingOrganizationId: liveTemplate.trainingOrganizationId,
          organizationName: liveTemplate.trainingOrganization.name,
          logoUrl: liveTemplate.logoUrl,
          signatoryName: liveTemplate.signatoryName,
          signatoryTitle: liveTemplate.signatoryTitle,
          layoutJson: liveTemplate.layoutJson,
        }
      : null;

  const branding = designTemplate
    ? {
        organizationName: designTemplate.organizationName,
        logoUrl: designTemplate.logoUrl,
        signatoryName: designTemplate.signatoryName,
        signatoryTitle: designTemplate.signatoryTitle,
      }
    : undefined;
  const layoutJson = designTemplate ? (designTemplate.layoutJson as unknown as CertificateLayout | null) : null;

  // Watermark removal is a LIVE billing state, not part of the frozen
  // design — looked up fresh by the org id regardless of when the
  // certificate was issued, same reasoning as designSnapshot.ts's own
  // comment on why it's deliberately excluded from the snapshot. No org
  // template at all (AAICBI's own default design) always carries it —
  // there's no org to pay to remove it.
  let showWatermark = true;
  if (designTemplate) {
    const org = await prisma.trainingOrganization.findUnique({
      where: { id: designTemplate.trainingOrganizationId },
      select: { brandingFooterRemoved: true, certWatermarkCurrentPeriodEnd: true, certWatermarkAccessRevokedAt: true },
    });
    showWatermark = org ? shouldShowCertWatermark(org) : true;
  }

  const certificate = courseCertificate
    ? {
        code: courseCertificate.code,
        issuedAt: courseCertificate.issuedAt,
        revokedAt: courseCertificate.revokedAt,
        traineeName: courseCertificate.courseExamAttempt?.certificateName || courseCertificate.trainee.name,
        credentialTitle: courseCertificate.course.title,
        verb: "has successfully completed",
      }
    : examCertificateRow
      ? {
          code: examCertificateRow.code,
          issuedAt: examCertificateRow.issuedAt,
          revokedAt: examCertificateRow.revokedAt,
          traineeName: examCertificateRow.examAttempt?.certificateName || examCertificateRow.trainee.name,
          credentialTitle: examCertificateRow.exam.title,
          verb: "has successfully passed",
        }
      : null;

  if (!certificate) {
    return (
      <>
        <SiteHeader nav={nav} />
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <div className="rounded-2xl border border-brand-roseLight bg-brand-roseLight/40 p-8">
            <Icon icon={XCircle} size="xl" className="text-brand-rose" />
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
            <Icon icon={AlertTriangle} size="xl" className="text-brand-goldText" />
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
  const qrDataUrl = await certificateQrCodeDataUrl(verificationUrl);

  return (
    <>
      <SiteHeader nav={nav} />
      <main className="mx-auto max-w-2xl px-6 py-12 print:py-4">
        <CertificateDisplay
          traineeName={certificate.traineeName}
          verb={certificate.verb}
          credentialTitle={certificate.credentialTitle}
          issuedAt={certificate.issuedAt}
          code={certificate.code}
          qrDataUrl={qrDataUrl}
          branding={branding}
          layoutJson={layoutJson}
          showWatermark={showWatermark}
        />

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
