import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import SiteHeader from "@/components/SiteHeader";
import CertificateDisplay from "@/components/CertificateDisplay";
import type { CertificateLayout } from "@/lib/certificateLayout";
import ApproveTemplateButton from "@/components/ApproveTemplateButton";
import { CheckCircle2 } from "lucide-react";
import Icon from "@/components/ui/Icon";

/**
 * Training Organizations, Phase 1 — the public, token-addressed,
 * no-login template review page, copying /certificate/[code]'s exact
 * convention (IP rate-limited, generic not-found state, anonymous
 * Prisma lookup). The VIEW stays reachable forever via this token; only
 * the Approve action (ApproveTemplateButton, the one client sliver on
 * this otherwise server-rendered page, same shape as
 * PrintCertificateButton) is single-use, guarded server-side.
 */
export default async function CertificateTemplateReviewPage({ params }: { params: { token: string } }) {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await rateLimit(`certificate-template-review:${ip}`, 60, 60 * 60 * 1000);

  if (!allowed) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <p className="text-gray-600">Too many requests from this connection. Please try again in a few minutes.</p>
        </main>
      </>
    );
  }

  const template = await prisma.certificateTemplate.findUnique({
    where: { reviewToken: params.token.toUpperCase() },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      approvedAt: true,
      layoutJson: true,
      signatoryName: true,
      signatoryTitle: true,
      trainingOrganization: { select: { name: true, contactName: true } },
    },
  });

  if (!template) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <div className="rounded-2xl border border-brand-roseLight bg-brand-roseLight/40 p-8">
            <p className="font-display text-lg font-semibold text-brand-rose">Not Found</p>
            <p className="mt-2 text-sm text-brand-rose">This review link isn&apos;t valid.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-center font-display text-xl font-semibold text-brand-ink">
          Review Your Certificate — {template.name}
        </h1>
        <p className="mt-1 text-center text-sm text-gray-500">
          This is exactly how your trainees&apos; certificates will look once approved.
        </p>

        <div className="mt-6">
          <CertificateDisplay
            traineeName="Jane Doe"
            verb="has successfully completed"
            credentialTitle="Sample Course"
            issuedAt={new Date()}
            code="SAMPLE-0000-0000"
            branding={{
              organizationName: template.trainingOrganization.name,
              logoUrl: template.logoUrl,
              signatoryName: template.signatoryName,
              signatoryTitle: template.signatoryTitle,
            }}
            layoutJson={template.layoutJson as unknown as CertificateLayout | null}
          />
        </div>

        <div className="mt-6 text-center">
          {template.approvedAt ? (
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-teal">
              <Icon icon={CheckCircle2} size="sm" /> Approved — this template is now in use.
            </p>
          ) : (
            <ApproveTemplateButton token={params.token} />
          )}
        </div>
      </main>
    </>
  );
}
