"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";

const NAV = [
  { label: "Dashboard", href: "/trainee/dashboard" },
  { label: "Pitch & Post", href: "/trainee/pitch" },
];

interface FormState {
  startupName: string;
  industry: string;
  problem: string;
  solution: string;
  targetMarket: string;
  businessModel: string;
  stage: string;
  traction: string;
  teamDescription: string;
  pitchVideoUrl: string;
  pitchDeckUrl: string;
  demoUrl: string;
  githubUrl: string;
  fundingType: "GRANT" | "DEBT";
  fundingAmount: string;
  minimumInvestment: string;
  fundingPurpose: string;
}

/**
 * /trainee/pitch/[id]/edit — only reachable (per the API's own gate)
 * while the pitch is DRAFT or NEEDS_REVISION. Re-submitting from
 * NEEDS_REVISION moves it back to SUBMITTED — see the PATCH route's own
 * comment for why the prior rejection note is cleared at that point.
 */
export default function EditPitchPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch(`/api/trainee/pitches/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p) =>
        setForm({
          startupName: p.startupName ?? "",
          industry: p.industry ?? "",
          problem: p.problem ?? "",
          solution: p.solution ?? "",
          targetMarket: p.targetMarket ?? "",
          businessModel: p.businessModel ?? "",
          stage: p.stage ?? "",
          traction: p.traction ?? "",
          teamDescription: p.teamDescription ?? "",
          pitchVideoUrl: p.pitchVideoUrl ?? "",
          pitchDeckUrl: p.pitchDeckUrl ?? "",
          demoUrl: p.demoUrl ?? "",
          githubUrl: p.githubUrl ?? "",
          fundingType: p.fundingType ?? "GRANT",
          fundingAmount: p.fundingAmountKobo != null ? String(p.fundingAmountKobo / 100) : "",
          minimumInvestment: p.minimumInvestmentKobo != null ? String(p.minimumInvestmentKobo / 100) : "",
          fundingPurpose: p.fundingPurpose ?? "",
        })
      )
      .catch(() => setLoadError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function save(submit: boolean) {
    if (!form || !form.startupName.trim()) {
      showToast("Give your venture a name first.", "error");
      return;
    }
    setSaving(submit ? "submit" : "draft");
    const res = await fetch(`/api/trainee/pitches/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        fundingAmountKobo: form.fundingAmount ? Math.round(Number(form.fundingAmount) * 100) : undefined,
        minimumInvestmentKobo: form.minimumInvestment ? Math.round(Number(form.minimumInvestment) * 100) : undefined,
        submit,
      }),
    });
    setSaving(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not save your pitch.", "error");
      return;
    }
    showToast(submit ? "Your pitch is under review." : "Draft saved.", "success");
    router.push(`/trainee/pitch/${params.id}`);
  }

  if (loadError) {
    return (
      <>
        <SiteHeader nav={NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <p className="text-sm text-gray-500">This pitch can no longer be edited, or wasn&apos;t found.</p>
        </main>
      </>
    );
  }

  if (!form) {
    return (
      <>
        <SiteHeader nav={NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <SkeletonList rows={3} />
        </main>
      </>
    );
  }

  const input = "w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal";
  const label = "text-xs font-semibold uppercase tracking-wide text-gray-500";

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Edit Pitch</h1>

        <Card className="mt-6 space-y-4">
          <p className={label}>Startup</p>
          <input className={input} placeholder="Startup / project name" value={form.startupName} onChange={(e) => set("startupName", e.target.value)} />
          <input className={input} placeholder="Industry" value={form.industry} onChange={(e) => set("industry", e.target.value)} />
          <input className={input} placeholder="Stage" value={form.stage} onChange={(e) => set("stage", e.target.value)} />
          <textarea className={input} rows={2} placeholder="Problem" value={form.problem} onChange={(e) => set("problem", e.target.value)} />
          <textarea className={input} rows={2} placeholder="Solution" value={form.solution} onChange={(e) => set("solution", e.target.value)} />
          <textarea className={input} rows={2} placeholder="Target market" value={form.targetMarket} onChange={(e) => set("targetMarket", e.target.value)} />
          <textarea className={input} rows={2} placeholder="Business model" value={form.businessModel} onChange={(e) => set("businessModel", e.target.value)} />
          <textarea className={input} rows={2} placeholder="Traction" value={form.traction} onChange={(e) => set("traction", e.target.value)} />
          <textarea className={input} rows={2} placeholder="Team" value={form.teamDescription} onChange={(e) => set("teamDescription", e.target.value)} />
        </Card>

        <Card className="mt-4 space-y-4">
          <p className={label}>Pitch Materials</p>
          <input className={input} placeholder="Pitch video URL" value={form.pitchVideoUrl} onChange={(e) => set("pitchVideoUrl", e.target.value)} />
          <input className={input} placeholder="Pitch deck URL" value={form.pitchDeckUrl} onChange={(e) => set("pitchDeckUrl", e.target.value)} />
          <input className={input} placeholder="Demo URL" value={form.demoUrl} onChange={(e) => set("demoUrl", e.target.value)} />
          <input className={input} placeholder="GitHub URL" value={form.githubUrl} onChange={(e) => set("githubUrl", e.target.value)} />
        </Card>

        <Card className="mt-4 space-y-4">
          <p className={label}>Funding Ask</p>
          <div className="grid grid-cols-2 gap-3">
            <input className={input} type="number" min="0" placeholder="Amount requested (₦)" value={form.fundingAmount} onChange={(e) => set("fundingAmount", e.target.value)} />
            <input className={input} type="number" min="0" placeholder="Minimum investment (₦)" value={form.minimumInvestment} onChange={(e) => set("minimumInvestment", e.target.value)} />
          </div>
          <textarea className={input} rows={2} placeholder="Purpose of funding" value={form.fundingPurpose} onChange={(e) => set("fundingPurpose", e.target.value)} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => set("fundingType", "GRANT")}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${form.fundingType === "GRANT" ? "bg-brand-teal text-white" : "border border-brand-gray text-brand-ink"}`}
            >
              Grant
            </button>
            <button
              type="button"
              onClick={() => set("fundingType", "DEBT")}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${form.fundingType === "DEBT" ? "bg-brand-teal text-white" : "border border-brand-gray text-brand-ink"}`}
            >
              Debt
            </button>
          </div>
        </Card>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => save(false)} loading={saving === "draft"}>
            Save Draft
          </Button>
          <Button onClick={() => save(true)} loading={saving === "submit"}>
            Submit for Review
          </Button>
        </div>
      </main>
    </>
  );
}
