import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { certificateQrCodeSvg } from "@/lib/certificateQr";
import { appUrl } from "@/lib/appUrl";
import SiteHeader from "@/components/SiteHeader";
import PrintCertificateButton from "@/components/PrintCertificateButton";
import CertificateCard from "@/components/CertificateCard";
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
      trainee: { select: { name: true } },
      course: {
        select: {
          title: true,
          description: true,
          // Training Organizations, Phase 1 — the org admin's own
          // chosen template for this course, if any (see Course.
          // certificateTemplateId's own schema comment). Only
          // included so the render below can branch on it; an
          // unapproved template is never used even if assigned.
          certificateTemplate: {
            select: {
              logoUrl: true,
              primaryColor: true,
              accentColor: true,
              approvedAt: true,
              trainingOrganization: { select: { name: true, brandingFooterRemoved: true } },
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

  // Training Organizations, Phase 1 — only an APPROVED template ever
  // renders, even if one is assigned; a course pointed at a template
  // still mid-review shows AAICBI's own default until the org actually
  // approves it.
  const assignedTemplate = courseCertificate?.course.certificateTemplate;
  const branding =
    assignedTemplate && assignedTemplate.approvedAt
      ? {
          organizationName: assignedTemplate.trainingOrganization.name,
          logoUrl: assignedTemplate.logoUrl,
          primaryColor: assignedTemplate.primaryColor,
          accentColor: assignedTemplate.accentColor,
          hideFooter: assignedTemplate.trainingOrganization.brandingFooterRemoved,
        }
      : undefined;

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
  const qrSvg = await certificateQrCodeSvg(verificationUrl);

  return (
    <>
      <SiteHeader nav={nav} />
      <main className="mx-auto max-w-2xl px-6 py-12 print:py-4">
        <CertificateCard
          traineeName={certificate.traineeName}
          verb={certificate.verb}
          credentialTitle={certificate.credentialTitle}
          issuedAt={certificate.issuedAt}
          code={certificate.code}
          qrSvg={qrSvg}
          branding={branding}
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
