import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { hasActivePlatformFeeAccess } from "@/lib/trainingOrgBilling";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/org/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PayPlatformFeeButton from "@/components/org/PayPlatformFeeButton";

/**
 * Direct platform-fee billing — the organization's own status/gate
 * page. Reached two ways: redirected here by admin/layout.tsx when
 * billing-gated, or navigated here directly. Does its own
 * getSession()-then-redirect() check, the same real per-page discipline
 * every other page in this app uses — not reliant on the layout
 * redirect alone (see requireRole's own comment: that's the actual
 * security boundary; this page is just where a gated session lands).
 */
export default async function OrgBillingPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/org/login");
  }

  const org = await findTrainingOrgByStaffUserId(session.userId);
  if (!org || org.billingModel !== "DIRECT_PAYMENT") {
    redirect("/admin/dashboard");
  }

  const isActive = hasActivePlatformFeeAccess(org);
  const feeConfigured = !!org.platformFeeKobo && !!org.platformFeeBillingInterval;
  const feeLabel = feeConfigured
    ? `₦${(org.platformFeeKobo! / 100).toLocaleString()} / ${org.platformFeeBillingInterval!.toLowerCase()}`
    : null;

  return (
    <>
      <SiteHeader right={<LogoutButton />} />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col justify-center px-6">
        <Card>
          <h1 className="font-display text-xl font-semibold text-brand-ink">Platform Access</h1>

          {isActive ? (
            <>
              <p className="mt-2 text-sm text-gray-600">
                Your platform access is active until{" "}
                <span className="font-semibold text-brand-ink">{org.platformFeeCurrentPeriodEnd!.toLocaleDateString()}</span>.
              </p>
              <Button href="/admin/dashboard" className="mt-5 w-full">
                Go to Your Dashboard
              </Button>
            </>
          ) : !feeConfigured ? (
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
                Your platform fee is <span className="font-semibold text-brand-ink">{feeLabel}</span>.
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
      </main>
    </>
  );
}
