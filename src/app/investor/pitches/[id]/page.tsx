"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";

interface PitchDetail {
  id: string;
  startupName: string;
  industry: string | null;
  stage: string | null;
  problem: string | null;
  solution: string | null;
  targetMarket: string | null;
  businessModel: string | null;
  traction: string | null;
  fundingType: "GRANT" | "DEBT" | null;
  fundingAmountKobo: number | null;
  minimumInvestmentKobo: number | null;
  disclosureStatus: "PENDING" | "ACCEPTED" | "DECLINED" | null;
  interestedAt: string | null;
  pitchVideoUrl: string | null;
  pitchDeckUrl: string | null;
  demoUrl: string | null;
  githubUrl: string | null;
}

export default function InvestorPitchDetailPage({ params }: { params: { id: string } }) {
  const { showToast } = useToast();
  const [pitch, setPitch] = useState<PitchDetail | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [interestMessage, setInterestMessage] = useState("");
  const [investmentRange, setInvestmentRange] = useState("");
  const [busy, setBusy] = useState<"request" | "interest" | null>(null);

  function load() {
    fetch(`/api/investor/pitches/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPitch)
      .catch(() => setPitch(null));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function requestDisclosure() {
    setBusy("request");
    const res = await fetch(`/api/investor/pitches/${params.id}/request-disclosure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: requestMessage }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not send that request.", "error");
      return;
    }
    showToast("Request sent to the founder.", "success");
    load();
  }

  async function expressInterest() {
    setBusy("interest");
    const res = await fetch(`/api/investor/pitches/${params.id}/interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: interestMessage,
        investmentRangeKobo: investmentRange ? Math.round(Number(investmentRange) * 100) : undefined,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not send your interest.", "error");
      return;
    }
    showToast("Your interest has been received — the AAICBI team will follow up.", "success");
    load();
  }

  if (!pitch) {
    return (
      <>
        <SiteHeader nav={[{ label: "Investment Opportunities", href: "/investor/dashboard" }]} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <SkeletonList rows={3} />
        </main>
      </>
    );
  }

  const unlocked = pitch.disclosureStatus === "ACCEPTED";

  return (
    <>
      <SiteHeader nav={[{ label: "Investment Opportunities", href: "/investor/dashboard" }]} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-brand-ink">{pitch.startupName}</h1>
          {pitch.industry && <Badge variant="success">{pitch.industry}</Badge>}
        </div>

        <Card className="mt-4 space-y-2 text-sm text-gray-700">
          {pitch.stage && <p><span className="font-semibold text-brand-ink">Stage:</span> {pitch.stage}</p>}
          {pitch.problem && <p><span className="font-semibold text-brand-ink">Problem:</span> {pitch.problem}</p>}
          {pitch.fundingAmountKobo != null && (
            <p>
              <span className="font-semibold text-brand-ink">Funding requested:</span> ₦{(pitch.fundingAmountKobo / 100).toLocaleString()} {pitch.fundingType ? `· ${pitch.fundingType}` : ""}
            </p>
          )}
        </Card>

        {unlocked ? (
          <>
            <Card className="mt-4 space-y-2 text-sm text-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Full Pitch Materials</p>
              {pitch.solution && <p><span className="font-semibold text-brand-ink">Solution:</span> {pitch.solution}</p>}
              {pitch.targetMarket && <p><span className="font-semibold text-brand-ink">Target Market:</span> {pitch.targetMarket}</p>}
              {pitch.businessModel && <p><span className="font-semibold text-brand-ink">Business Model:</span> {pitch.businessModel}</p>}
              {pitch.traction && <p><span className="font-semibold text-brand-ink">Traction:</span> {pitch.traction}</p>}
              <div className="flex flex-wrap gap-2 pt-2">
                {pitch.pitchVideoUrl && <a href={pitch.pitchVideoUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold">▶ Watch Pitch</a>}
                {pitch.pitchDeckUrl && <a href={pitch.pitchDeckUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold">Open Deck</a>}
                {pitch.demoUrl && <a href={pitch.demoUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold">Open Demo</a>}
                {pitch.githubUrl && <a href={pitch.githubUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold">Open Repository</a>}
              </div>
            </Card>

            <Card className="mt-4">
              {pitch.interestedAt ? (
                <p className="text-sm font-semibold text-brand-teal">Your interest has been received — the AAICBI team will follow up.</p>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Express Interest</p>
                  <textarea
                    value={interestMessage}
                    onChange={(e) => setInterestMessage(e.target.value)}
                    rows={3}
                    placeholder="Message"
                    className="mt-2 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                  <input
                    type="number"
                    min="0"
                    value={investmentRange}
                    onChange={(e) => setInvestmentRange(e.target.value)}
                    placeholder="Investment range (₦, optional)"
                    className="mt-2 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                  <Button size="sm" className="mt-3" onClick={expressInterest} loading={busy === "interest"}>
                    Submit Interest
                  </Button>
                </>
              )}
            </Card>
          </>
        ) : pitch.disclosureStatus === "PENDING" ? (
          <Card className="mt-4">
            <p className="text-sm text-gray-600">Your request to see the full pitch is pending the founder's response.</p>
          </Card>
        ) : pitch.disclosureStatus === "DECLINED" ? (
          <Card className="mt-4">
            <p className="text-sm text-gray-600">This founder isn&apos;t sharing full materials with you at this time.</p>
          </Card>
        ) : (
          <Card className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Request Full Pitch</p>
            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              rows={3}
              placeholder="A short note to the founder (optional)"
              className="mt-2 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <Button size="sm" className="mt-3" onClick={requestDisclosure} loading={busy === "request"}>
              Request Full Pitch
            </Button>
          </Card>
        )}
      </main>
    </>
  );
}
