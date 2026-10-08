"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import PitchLoopPanel from "@/components/trainee/PitchLoopPanel";
import { TRAINEE_NAV } from "@/lib/trainee/nav";

import FormSteps from "@/components/ui/FormSteps";
import StickyActions from "@/components/ui/StickyActions";
import { Input, Textarea } from "@/components/ui/Field";
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
  teaserVideoUrl: "",
  projectedReturnSummary: "",
  publicImpactStatement: "",
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

  const label = "text-xs font-semibold uppercase tracking-wide text-gray-500";

  return (
    <>
      <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Submit a Pitch</h1>
        <p className="mt-1 text-sm text-gray-500">Save a draft any time, or submit when you're ready for review.</p>

        <FormSteps className="" labels={["Startup", "Pitch materials", "Public teaser", "Funding ask"]} footer={<div className="mt-6">
            <StickyActions className="justify-end">
              <Button variant="secondary" onClick={() => save(false)} loading={saving === "draft"}>
                Save Draft
              </Button>
              <Button onClick={() => save(true)} loading={saving === "submit"}>
                Submit for Review
              </Button>
            </StickyActions>
          </div>}>
        <Card className="mt-6 space-y-4">
          <p className={label}>Startup</p>
          <Input label="Startup / project name" value={form.startupName} onChange={(e) => set("startupName", e.target.value)} />
          <Input label="Industry (e.g. HealthTech)" value={form.industry} onChange={(e) => set("industry", e.target.value)} />
          <Input label="Stage (e.g. Prototype, MVP)" value={form.stage} onChange={(e) => set("stage", e.target.value)} />
          <Textarea label="Problem you're solving" rows={2} value={form.problem} onChange={(e) => set("problem", e.target.value)} />
          <Textarea label="Your solution" rows={2} value={form.solution} onChange={(e) => set("solution", e.target.value)} />
          <Textarea label="Target market" rows={2} value={form.targetMarket} onChange={(e) => set("targetMarket", e.target.value)} />
          <Textarea label="Business model" rows={2} value={form.businessModel} onChange={(e) => set("businessModel", e.target.value)} />
          <Textarea label="Traction so far" rows={2} value={form.traction} onChange={(e) => set("traction", e.target.value)} />
          <Textarea label="Team" rows={2} value={form.teamDescription} onChange={(e) => set("teamDescription", e.target.value)} />
        </Card>

        <Card className="mt-4 space-y-4">
          <p className={label}>Pitch Materials</p>
          <Input label="Pitch video URL" value={form.pitchVideoUrl} onChange={(e) => set("pitchVideoUrl", e.target.value)} />
          <Input label="Pitch deck URL" value={form.pitchDeckUrl} onChange={(e) => set("pitchDeckUrl", e.target.value)} />
          <Input label="Demo URL" value={form.demoUrl} onChange={(e) => set("demoUrl", e.target.value)} />
          <Input label="GitHub URL" value={form.githubUrl} onChange={(e) => set("githubUrl", e.target.value)} />
        </Card>

        <Card className="mt-4 space-y-4">
          <p className={label}>Public Teaser</p>
          <p className="text-xs text-gray-500">
            Shown to every investor browsing, before they request your full pitch — keep this high-level, not how your business works.
          </p>
          <Input label="Teaser video URL (YouTube or Google-hosted)" value={form.teaserVideoUrl} onChange={(e) => set("teaserVideoUrl", e.target.value)} />
          <Input label="Projected return, e.g. &quot;Projected ₦150M ARR by Year 3&quot;" value={form.projectedReturnSummary} onChange={(e) => set("projectedReturnSummary", e.target.value)} />
          <Textarea label="Public impact statement — outcomes and scale, not mechanism" rows={2} value={form.publicImpactStatement} onChange={(e) => set("publicImpactStatement", e.target.value)} />
        </Card>

        <Card className="mt-4 space-y-4">
          <p className={label}>Funding Ask</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount requested (₦)" type="number" min="0" value={form.fundingAmount} onChange={(e) => set("fundingAmount", e.target.value)} />
            <Input label="Minimum investment (₦)" type="number" min="0" value={form.minimumInvestment} onChange={(e) => set("minimumInvestment", e.target.value)} />
          </div>
          <Textarea label="Purpose of funding" rows={2} value={form.fundingPurpose} onChange={(e) => set("fundingPurpose", e.target.value)} />
          <div>
            <p className={label}>Funding type</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => set("fundingType", "GRANT")}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  form.fundingType === "GRANT" ? "bg-brand-teal text-brand-onAccent" : "border border-brand-gray text-brand-ink"
                }`}
              >
                Grant
              </button>
              <button
                type="button"
                onClick={() => set("fundingType", "DEBT")}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  form.fundingType === "DEBT" ? "bg-brand-teal text-brand-onAccent" : "border border-brand-gray text-brand-ink"
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

        </FormSteps>

        <PitchLoopPanel
          draft={{
            startupName: form.startupName,
            industry: form.industry,
            problem: form.problem,
            solution: form.solution,
            targetMarket: form.targetMarket,
            businessModel: form.businessModel,
            stage: form.stage,
            traction: form.traction,
            teamDescription: form.teamDescription,
            fundingType: form.fundingType,
            fundingAmountKobo: form.fundingAmount ? Math.round(Number(form.fundingAmount) * 100) : undefined,
            fundingPurpose: form.fundingPurpose,
          }}
        />

      </main>
    </>
  );
}
