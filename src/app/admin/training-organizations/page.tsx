"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

import { Checkbox, Input, Select } from "@/components/ui/Field";
interface TrainingOrgDto {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string | null;
  website: string | null;
  approvalState: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  approvedBy: { name: string } | null;
  certificateTemplates: { id: string; name: string; approvedAt: string | null }[];
  // Training Organizations, Phase 2
  paystackSubaccountCode: string | null;
  brandingFooterRemoved: boolean;
  // Direct platform-fee billing
  billingModel: "REVENUE_SHARE" | "DIRECT_PAYMENT";
  platformFeeKobo: number | null;
  platformFeeBillingInterval: "MONTHLY" | "QUARTERLY" | "ANNUALLY" | null;
  platformFeeCurrentPeriodEnd: string | null;
  platformFeeAccessRevokedAt: string | null;
  suspendTraineeAccessOnLapse: boolean;
  // Trainee seat cap + waiver
  trainingSeatCap: number | null;
  accessBlockWaived: boolean;
  activeTraineeCount: number | null;
  // Certificate watermark removal — a second, independent subscription
  // product, same shape as the platformFee* fields above.
  certWatermarkFeeKobo: number | null;
  certWatermarkBillingInterval: "MONTHLY" | "QUARTERLY" | "ANNUALLY" | null;
  certWatermarkCurrentPeriodEnd: string | null;
  certWatermarkAccessRevokedAt: string | null;
}

/**
 * Training Organizations, Phase 1 — the review queue, same Pending
 * Review / Previously Decided shape as /admin/employers. No per-page
 * SiteHeader call — new pages built after the admin sidebar rollout
 * don't need one; the sidebar provides navigation.
 */
export default function AdminTrainingOrganizationsPage() {
  const [orgs, setOrgs] = useState<TrainingOrgDto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    setLoadError(false);
    fetch("/api/admin/training-organizations")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setOrgs)
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, action: "APPROVE" | "REJECT") {
    setBusyId(id);
    const res = await fetch(`/api/admin/training-organizations/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (!res.ok) {
      showToast("Could not complete that action. Try again.", "error");
      return;
    }
    showToast(action === "APPROVE" ? "Organization approved." : "Organization rejected.");
    load();
  }

  const pending = orgs?.filter((o) => o.approvalState === "PENDING") ?? [];
  const decided = orgs?.filter((o) => o.approvalState !== "PENDING") ?? [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Training Organizations</h1>

      <h2 className="mt-6 text-sm font-semibold text-gray-500">Pending Review ({pending.length})</h2>
      <div className="mt-2 space-y-3">
        {loadError ? (
          <ErrorState message="We couldn't load training organizations." onRetry={load} />
        ) : orgs === null ? (
          <SkeletonList />
        ) : pending.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing waiting on review.</p>
        ) : (
          pending.map((o) => (
            <Card key={o.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display font-semibold text-brand-ink">{o.name}</p>
                  <p className="text-xs text-gray-500">
                    {o.contactName} · {o.email}
                    {o.phone && ` · ${o.phone}`}
                  </p>
                  {o.website && (
                    <a href={o.website} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-brand-teal hover:underline">
                      Website
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => decide(o.id, "APPROVE")} loading={busyId === o.id}>
                    Approve
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => decide(o.id, "REJECT")} loading={busyId === o.id}>
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {decided.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-gray-500">Previously Decided</h2>
          <div className="mt-2 space-y-3">
            {decided.map((o) => (
              <Card key={o.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-brand-ink">{o.name}</p>
                    <p className="text-xs text-gray-500">
                      {o.contactName} · {o.email}
                      {o.approvedBy && ` · decided by ${o.approvedBy.name}`}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold ${o.approvalState === "APPROVED" ? "text-brand-teal" : "text-brand-rose"}`}>
                    {o.approvalState === "APPROVED" ? "Approved" : "Rejected"}
                  </span>
                </div>
                {o.approvalState === "APPROVED" && (
                  <>
                    <a
                      href={`/admin/training-organizations/${o.id}/certificate-templates`}
                      className="mt-3 inline-block text-xs font-semibold text-brand-teal hover:underline"
                    >
                      Manage certificate templates
                      {o.certificateTemplates.length > 0 && ` (${o.certificateTemplates.length})`} →
                    </a>
                    <PayoutSettings org={o} onSaved={load} showToast={showToast} />
                    <PlatformFeeSettings org={o} onSaved={load} showToast={showToast} />
                    <CertWatermarkSettings org={o} onSaved={load} showToast={showToast} />
                  </>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

/**
 * Training Organizations, Phase 2 — the two payout/billing settings
 * SUPER_ADMIN sets by hand: the Paystack Subaccount code (created
 * manually in Paystack's own dashboard, where the split percentage
 * itself is also configured — see TrainingOrganization.
 * paystackSubaccountCode's own schema comment for why there's no
 * separate percentage field here) and the "Powered by aaicbi.org"
 * premium-removal toggle. One inline form on each approved org's own
 * card, rather than a separate settings page, since it's only two
 * fields.
 */
function PayoutSettings({
  org,
  onSaved,
  showToast,
}: {
  org: TrainingOrgDto;
  onSaved: () => void;
  showToast: (message: string, variant?: "success" | "error") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(org.paystackSubaccountCode ?? "");
  const [footerRemoved, setFooterRemoved] = useState(org.brandingFooterRemoved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setCode(org.paystackSubaccountCode ?? "");
    setFooterRemoved(org.brandingFooterRemoved);
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/training-organizations/${org.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paystackSubaccountCode: code.trim() || null,
        brandingFooterRemoved: footerRemoved,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save. Try again.");
      return;
    }
    setEditing(false);
    showToast("Payout settings saved.");
    onSaved();
  }

  return (
    <div className="mt-3 rounded-lg border border-brand-gray bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Payout Settings</p>
        {!editing && (
          <button onClick={startEditing} className="text-xs font-semibold text-brand-teal hover:underline">
            Edit
          </button>
        )}
      </div>
      {!editing && (
        <p className="mt-1 text-xs text-gray-500">
          {org.paystackSubaccountCode ? `Subaccount: ${org.paystackSubaccountCode}` : "No Paystack Subaccount set — payments land fully with AAICBI."}
          {org.brandingFooterRemoved && " · \"Powered by aaicbi.org\" removed"}
        </p>
      )}
      {editing && (
        <div className="mt-2 space-y-2">
          <Input label="Paystack Subaccount code" compact hint={<>Create the Subaccount in Paystack&apos;s own dashboard first (that&apos;s also where its split percentage is set), then paste its code here. Blank means trainee payments for this organization&apos;s courses land entirely with AAICBI, same as any other course.</>} value={code} onChange={(e) => setCode(e.target.value)} placeholder="ACCT_xxxxxxxxxxxx" />
          <Checkbox label="Remove &quot;Powered by aaicbi.org&quot; from this organization&apos;s certificates (premium)" checked={footerRemoved} onChange={(e) => setFooterRemoved(e.target.checked)} />
          {error && <p className="text-xs text-brand-rose">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-brand-onAccent disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Direct platform-fee billing — the second, mutually-exclusive revenue
 * model: instead of the Paystack Subaccount split above, the
 * organization pays AAICBI a recurring fee directly. The billing-model
 * selector is always visible (SUPER_ADMIN can correct what the org
 * picked at registration); the fee/interval/status/confirm-payment
 * controls only matter once DIRECT_PAYMENT is selected.
 */
function PlatformFeeSettings({
  org,
  onSaved,
  showToast,
}: {
  org: TrainingOrgDto;
  onSaved: () => void;
  showToast: (message: string, variant?: "success" | "error") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [billingModel, setBillingModel] = useState(org.billingModel);
  const [feeNaira, setFeeNaira] = useState(org.platformFeeKobo != null ? String(org.platformFeeKobo / 100) : "");
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "QUARTERLY" | "ANNUALLY">(org.platformFeeBillingInterval ?? "MONTHLY");
  const [suspendOnLapse, setSuspendOnLapse] = useState(org.suspendTraineeAccessOnLapse);
  const [seatCap, setSeatCap] = useState(org.trainingSeatCap != null ? String(org.trainingSeatCap) : "");
  const [waived, setWaived] = useState(org.accessBlockWaived);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setBillingModel(org.billingModel);
    setFeeNaira(org.platformFeeKobo != null ? String(org.platformFeeKobo / 100) : "");
    setBillingInterval(org.platformFeeBillingInterval ?? "MONTHLY");
    setSuspendOnLapse(org.suspendTraineeAccessOnLapse);
    setSeatCap(org.trainingSeatCap != null ? String(org.trainingSeatCap) : "");
    setWaived(org.accessBlockWaived);
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const platformFeeKobo = feeNaira.trim() === "" ? null : Math.round(Number(feeNaira) * 100);
    const trainingSeatCap = seatCap.trim() === "" ? null : Math.round(Number(seatCap));
    const res = await fetch(`/api/admin/training-organizations/${org.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        billingModel,
        platformFeeKobo,
        platformFeeBillingInterval: platformFeeKobo ? billingInterval : null,
        suspendTraineeAccessOnLapse: suspendOnLapse,
        trainingSeatCap,
        accessBlockWaived: waived,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save. Try again.");
      return;
    }
    setEditing(false);
    showToast("Billing settings saved.");
    onSaved();
  }

  async function handleConfirmPayment() {
    setConfirming(true);
    const res = await fetch(`/api/admin/training-organizations/${org.id}/confirm-platform-fee`, { method: "POST" });
    setConfirming(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not confirm payment.", "error");
      return;
    }
    showToast("Payment confirmed — access is active.");
    onSaved();
  }

  const now = Date.now();
  const periodEnd = org.platformFeeCurrentPeriodEnd ? new Date(org.platformFeeCurrentPeriodEnd) : null;
  // The real, unwaived payment status — still used to decide whether to
  // show "Confirm Payment Received" below, since waiving access doesn't
  // change whether a real payment has actually landed.
  const isActive = org.billingModel === "DIRECT_PAYMENT" && org.platformFeeAccessRevokedAt === null && !!periodEnd && periodEnd.getTime() > now;
  const statusLabel =
    org.billingModel !== "DIRECT_PAYMENT"
      ? null
      : org.platformFeeAccessRevokedAt
        ? `Access revoked ${new Date(org.platformFeeAccessRevokedAt).toLocaleDateString()}`
        : isActive
          ? `Active until ${periodEnd!.toLocaleDateString()}`
          : "Not yet paid";
  const seatUsageLabel =
    org.billingModel === "DIRECT_PAYMENT" && org.trainingSeatCap
      ? `${org.activeTraineeCount ?? 0} / ${org.trainingSeatCap} trainees`
      : null;

  return (
    <div className="mt-3 rounded-lg border border-brand-gray bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Platform Fee Billing</p>
        {!editing && (
          <button onClick={startEditing} className="text-xs font-semibold text-brand-teal hover:underline">
            Edit
          </button>
        )}
      </div>
      {!editing && (
        <p className="mt-1 text-xs text-gray-500">
          {org.billingModel === "REVENUE_SHARE" ? "Revenue share (see Payout Settings above)" : "Direct payment"}
          {statusLabel && ` · ${statusLabel}`}
          {org.billingModel === "DIRECT_PAYMENT" && org.suspendTraineeAccessOnLapse && " · trainees blocked on lapse"}
          {seatUsageLabel && ` · ${seatUsageLabel}`}
          {org.billingModel === "DIRECT_PAYMENT" && org.accessBlockWaived && (
            <span className="font-semibold text-brand-teal"> · Access blocking waived</span>
          )}
        </p>
      )}
      {!editing && org.billingModel === "DIRECT_PAYMENT" && !isActive && org.platformFeeKobo && (
        <button
          onClick={handleConfirmPayment}
          disabled={confirming}
          className="mt-2 rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-brand-onAccent disabled:opacity-60"
        >
          {confirming ? "Confirming..." : "Confirm Payment Received"}
        </button>
      )}

      {editing && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-4 text-xs text-gray-700">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={billingModel === "REVENUE_SHARE"} onChange={() => setBillingModel("REVENUE_SHARE")} />
              Revenue share
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={billingModel === "DIRECT_PAYMENT"} onChange={() => setBillingModel("DIRECT_PAYMENT")} />
              Direct payment
            </label>
          </div>

          {billingModel === "DIRECT_PAYMENT" && (
            <>
              <div className="flex flex-wrap gap-3">
                <Input label="Platform fee (₦)" compact wrapperClassName="max-w-[10rem]" type="number" min={1} value={feeNaira} onChange={(e) => setFeeNaira(e.target.value)} placeholder="e.g. 50000" />
                <Select label="Billing interval" compact wrapperClassName="max-w-[10rem]" value={billingInterval} onChange={(e) => setBillingInterval(e.target.value as "MONTHLY" | "QUARTERLY" | "ANNUALLY")}>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="ANNUALLY">Annually</option>
                  </Select>
              </div>
              <Checkbox label="If payment lapses, also block trainees already enrolled in this organization&apos;s courses" checked={suspendOnLapse} onChange={(e) => setSuspendOnLapse(e.target.checked)} />

              <Input label="Trainee seat cap (blank = unlimited)" compact controlClassName="max-w-[8rem]" hint={<>Total trainees this organization can give access to, across all of its courses combined. Can be raised at any time, including mid-training.</>} type="number" min={1} value={seatCap} onChange={(e) => setSeatCap(e.target.value)} placeholder="e.g. 50" />

              <Checkbox label="Waive access blocking for this organization (permits training to continue regardless of payment or seat-cap status)" checked={waived} onChange={(e) => setWaived(e.target.checked)} />
            </>
          )}

          {error && <p className="text-xs text-brand-rose">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-brand-onAccent disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Certificate watermark removal — a second, independent monthly
 * product (see TrainingOrganization's own certWatermark* schema
 * comment), same editing/status/confirm-payment shape as
 * PlatformFeeSettings above but with nothing to do with billingModel:
 * always editable regardless of REVENUE_SHARE/DIRECT_PAYMENT.
 */
function CertWatermarkSettings({
  org,
  onSaved,
  showToast,
}: {
  org: TrainingOrgDto;
  onSaved: () => void;
  showToast: (message: string, variant?: "success" | "error") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [feeNaira, setFeeNaira] = useState(org.certWatermarkFeeKobo != null ? String(org.certWatermarkFeeKobo / 100) : "");
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "QUARTERLY" | "ANNUALLY">(org.certWatermarkBillingInterval ?? "MONTHLY");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setFeeNaira(org.certWatermarkFeeKobo != null ? String(org.certWatermarkFeeKobo / 100) : "");
    setBillingInterval(org.certWatermarkBillingInterval ?? "MONTHLY");
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const certWatermarkFeeKobo = feeNaira.trim() === "" ? null : Math.round(Number(feeNaira) * 100);
    const res = await fetch(`/api/admin/training-organizations/${org.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        certWatermarkFeeKobo,
        certWatermarkBillingInterval: certWatermarkFeeKobo ? billingInterval : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save. Try again.");
      return;
    }
    setEditing(false);
    showToast("Watermark-removal pricing saved.");
    onSaved();
  }

  async function handleConfirmPayment() {
    setConfirming(true);
    const res = await fetch(`/api/admin/training-organizations/${org.id}/confirm-cert-watermark-fee`, { method: "POST" });
    setConfirming(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not confirm payment.", "error");
      return;
    }
    showToast("Payment confirmed — watermark removed.");
    onSaved();
  }

  const now = Date.now();
  const periodEnd = org.certWatermarkCurrentPeriodEnd ? new Date(org.certWatermarkCurrentPeriodEnd) : null;
  const isActive = org.certWatermarkAccessRevokedAt === null && !!periodEnd && periodEnd.getTime() > now;
  const statusLabel = org.brandingFooterRemoved
    ? "Waived (see Payout Settings above)"
    : org.certWatermarkAccessRevokedAt
      ? `Lapsed ${new Date(org.certWatermarkAccessRevokedAt).toLocaleDateString()}`
      : isActive
        ? `Removed until ${periodEnd!.toLocaleDateString()}`
        : "Not paid — watermark shows";

  return (
    <div className="mt-3 rounded-lg border border-brand-gray bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Certificate Watermark Removal</p>
        {!editing && (
          <button onClick={startEditing} className="text-xs font-semibold text-brand-teal hover:underline">
            Edit
          </button>
        )}
      </div>
      {!editing && <p className="mt-1 text-xs text-gray-500">{statusLabel}</p>}
      {!editing && !org.brandingFooterRemoved && !isActive && org.certWatermarkFeeKobo && (
        <button
          onClick={handleConfirmPayment}
          disabled={confirming}
          className="mt-2 rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-brand-onAccent disabled:opacity-60"
        >
          {confirming ? "Confirming..." : "Confirm Payment Received"}
        </button>
      )}

      {editing && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-3">
            <Input label="Watermark-removal fee (₦)" compact wrapperClassName="max-w-[10rem]" type="number" min={1} value={feeNaira} onChange={(e) => setFeeNaira(e.target.value)} placeholder="e.g. 10000" />
            <Select label="Billing interval" compact wrapperClassName="max-w-[10rem]" value={billingInterval} onChange={(e) => setBillingInterval(e.target.value as "MONTHLY" | "QUARTERLY" | "ANNUALLY")}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUALLY">Annually</option>
              </Select>
          </div>

          {error && <p className="text-xs text-brand-rose">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-brand-onAccent disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
