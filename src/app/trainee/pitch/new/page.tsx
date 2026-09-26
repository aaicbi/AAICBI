"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const NAV = [
  { label: "Dashboard", href: "/trainee/dashboard" },
  { label: "Pitch & Post", href: "/trainee/pitch" },
];

const EMPTY_FORM = {
  startupName: "",
  industry: "",
  problem: "",
  solution: "",
  targetMarket: "",
  businessModel: "",
  stage: "",
  traction: "",
  teamDescription: "",
  pitchVideoUrl: "",
  pitchDeckUrl: "",
  demoUrl: "",
  githubUrl: "",
  fundingType: "GRANT" as "GRANT" | "DEBT",
  fundingAmount: "",
  minimumInvestment: "",
  fundingPurpose: "",
};

/**
 * /trainee/pitch/new — a single sectioned form rather than a stateful
 * multi-step wizard: same fields the UI/UX plan called for, materially
 * simpler to build and maintain. Equity is intentionally absent from
 * the funding-type choice — Phase 2 material, gated on legal review.
 */
export default function NewPitchPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(submit: boolean) {
    if (!form.startupName.trim()) {
      showToast("Give your venture a name first.", "error");
      return;
    }
    setSaving(submit ? "submit" : "draft");
    const res = await fetch("/api/trainee/pitches", {
      method: "POST",
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
    const created = await res.json();
    showToast(submit ? "Your pitch is under review." : "Draft saved.", "success");
    router.push(`/trainee/pitch/${created.id}`);
  }

  const input = "w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal";
  const label = "text-xs font-semibold uppercase tracking-wide text-gray-500";

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Submit a Pitch</h1>
        <p className="mt-1 text-sm text-gray-500">Save a draft any time, or submit when you're ready for review.</p>

        <Card className="mt-6 space-y-4">
          <p className={label}>Startup</p>
          <input className={input} placeholder="Startup / project name" value={form.startupName} onChange={(e) => set("startupName", e.target.value)} />
          <input className={input} placeholder="Industry (e.g. HealthTech)" value={form.industry} onChange={(e) => set("industry", e.target.value)} />
          <input className={input} placeholder="Stage (e.g. Prototype, MVP)" value={form.stage} onChange={(e) => set("stage", e.target.value)} />
          <textarea className={input} rows={2} placeholder="Problem you're solving" value={form.problem} onChange={(e) => set("problem", e.target.value)} />
          <textarea className={input} rows={2} placeholder="Your solution" value={form.solution} onChange={(e) => set("solution", e.target.value)} />
          <textarea className={input} rows={2} placeholder="Target market" value={form.targetMarket} onChange={(e) => set("targetMarket", e.target.value)} />
          <textarea className={input} rows={2} placeholder="Business model" value={form.businessModel} onChange={(e) => set("businessModel", e.target.value)} />
          <textarea className={input} rows={2} placeholder="Traction so far" value={form.traction} onChange={(e) => set("traction", e.target.value)} />
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
            <input
              className={input}
              type="number"
              min="0"
              placeholder="Amount requested (₦)"
              value={form.fundingAmount}
              onChange={(e) => set("fundingAmount", e.target.value)}
            />
            <input
              className={input}
              type="number"
              min="0"
              placeholder="Minimum investment (₦)"
              value={form.minimumInvestment}
              onChange={(e) => set("minimumInvestment", e.target.value)}
            />
          </div>
          <textarea className={input} rows={2} placeholder="Purpose of funding" value={form.fundingPurpose} onChange={(e) => set("fundingPurpose", e.target.value)} />
          <div>
            <p className={label}>Funding type</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => set("fundingType", "GRANT")}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  form.fundingType === "GRANT" ? "bg-brand-teal text-white" : "border border-brand-gray text-brand-ink"
                }`}
              >
                Grant
              </button>
              <button
                type="button"
                onClick={() => set("fundingType", "DEBT")}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  form.fundingType === "DEBT" ? "bg-brand-teal text-white" : "border border-brand-gray text-brand-ink"
                }`}
              >
                Debt
              </button>
              <span
                title="Available once AAICBI opens equity funding"
                className="rounded-full border border-brand-gray px-4 py-2 text-xs font-semibold text-gray-400"
              >
                🔒 Equity
              </span>
            </div>
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
