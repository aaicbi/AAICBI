import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { hasActivePlatformFeeAccess, hasActiveCertWatermarkRemoval } from "@/lib/trainingOrgBilling";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/org/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PayPlatformFeeButton from "@/components/org/PayPlatformFeeButton";
import PayCertWatermarkFeeButton from "@/components/org/PayCertWatermarkFeeButton";

/**
 * Direct platform-fee billing — the organization's own status/gate
 * page. Reached two ways: redirected here by admin/layout.tsx when
 * billing-gated, or navigated here directly. Does its own
 * getSession()-then-redirect() check, the same real per-page discipline
 * every other page in this app uses — not reliant on the layout
 * redirect alone (see requireRole's own comment: that's the actual
 * security boundary; this page is just where a gated session lands).
 *
 * No longer redirects away for a REVENUE_SHARE org — certificate
 * watermark removal (the second card below) is available to ANY org
 * regardless of billingModel, unlike the platform-fee card, which stays
 * scoped to DIRECT_PAYMENT inside the render instead of at the
 * page-level redirect.
 */
export default async function OrgBillingPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/org/login");
  }

  const org = await findTrainingOrgByStaffUserId(session.userId);
  if (!org) {
    redirect("/admin/dashboard");
  }

  const platformFeeActive = hasActivePlatformFeeAccess(org);
  const platformFeeConfigured = !!org.platformFeeKobo && !!org.platformFeeBillingInterval;
  const platformFeeLabel = platformFeeConfigured
    ? `₦${(org.platformFeeKobo! / 100).toLocaleString()} / ${org.platformFeeBillingInterval!.toLowerCase()}`
    : null;

  const watermarkWaived = org.brandingFooterRemoved;
  const watermarkActive = hasActiveCertWatermarkRemoval(org);
  const watermarkConfigured = !!org.certWatermarkFeeKobo && !!org.certWatermarkBillingInterval;
  const watermarkLabel = watermarkConfigured
    ? `₦${(org.certWatermarkFeeKobo! / 100).toLocaleString()} / ${org.certWatermarkBillingInterval!.toLowerCase()}`
    : null;

  return (
    <>
      <SiteHeader right={<LogoutButton />} />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col justify-center gap-4 px-6 py-10">
        {org.billingModel === "DIRECT_PAYMENT" && (
          <Card>
            <h1 className="font-display text-xl font-semibold text-brand-ink">Platform Access</h1>

            {platformFeeActive ? (
              <>
                <p className="mt-2 text-sm text-gray-600">
                  Your platform access is active until{" "}
                  <span className="font-semibold text-brand-ink">{org.platformFeeCurrentPeriodEnd!.toLocaleDateString()}</span>.
                </p>
                <Button href="/admin/dashboard" className="mt-5 w-full">
                  Go to Your Dashboard
                </Button>
              </>
            ) : !platformFeeConfigured ? (
              <p className="mt-2 text-sm text-gray-600">
                Your platform fee is still being set up. We&apos;ll email you once it&apos;s ready — you can also contact
                AAICBI directly if you&apos;d like to move this along.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-gray-600">
                  {org.platformFeeAccessRevokedAt
                    ? "Your last payment didn't go through, so access is currently paused."
                    : "You haven't completed your first payment yet."}{" "}
                  Your platform fee is <span className="font-semibold text-brand-ink">{platformFeeLabel}</span>.
                </p>
                <div className="mt-5">
                  <PayPlatformFeeButton />
                </div>
                <p className="mt-4 text-xs text-gray-500">
                  Prefer to pay another way? You can also arrange payment directly with AAICBI — contact us and we&apos;ll
                  confirm it on our end.
                </p>
              </>
            )}
          </Card>
        )}

        <Card>
          <h1 className="font-display text-xl font-semibold text-brand-ink">Certificate Branding</h1>

          {watermarkWaived ? (
            <p className="mt-2 text-sm text-gray-600">
              The &quot;Powered by AAICBI&quot; mark has been removed from your certificates by AAICBI directly — nothing
              more to do here.
            </p>
          ) : watermarkActive ? (
            <p className="mt-2 text-sm text-gray-600">
              The &quot;Powered by AAICBI&quot; mark is removed from your certificates until{" "}
              <span className="font-semibold text-brand-ink">{org.certWatermarkCurrentPeriodEnd!.toLocaleDateString()}</span>.
            </p>
          ) : !watermarkConfigured ? (
            <p className="mt-2 text-sm text-gray-600">
              Every certificate currently carries a &quot;Powered by AAICBI&quot; mark. Watermark-removal pricing hasn&apos;t
              been set up for your organization yet — contact AAICBI if you&apos;d like to remove it.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-gray-600">
                {org.certWatermarkAccessRevokedAt
                  ? "Your last watermark-removal payment didn't go through, so the mark is back on your certificates."
                  : "Every certificate currently carries a \"Powered by AAICBI\" mark."}{" "}
                Remove it for <span className="font-semibold text-brand-ink">{watermarkLabel}</span>.
              </p>
              <div className="mt-5">
                <PayCertWatermarkFeeButton />
              </div>
              <p className="mt-4 text-xs text-gray-500">
                Prefer to pay another way? You can also arrange payment directly with AAICBI — contact us and we&apos;ll
                confirm it on our end.
              </p>
            </>
          )}
        </Card>
      </main>
    </>
  );
}
